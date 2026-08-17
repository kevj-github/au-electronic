#!/usr/bin/env python3
"""
au-electronic Daily Improvement Cron Agent
==========================================

LLM-driven supervisor that drives a Claude Code instance living in a tmux
session, running daily autonomous improvement cycles on the au-electronic
Next.js project.

The cron agent is the OPERATOR: it decides what to ask for, watches Claude's
output, replies with the right follow-up, manages context, enforces safety
rails, and reports to the human over Telegram.

Usage:
    python3 ~/au-electronic-cron.py                    # normal 5h session
    python3 ~/au-electronic-cron.py --dry-run         # acceptance test 1
    python3 ~/au-electronic-cron.py --short-hours=0.17  # ~10min hard-stop test
    python3 ~/au-electronic-cron.py --no-commit        # skip git commit/push/PR
"""

import json
import os
import re
import subprocess
import sys
import time
import signal
import shutil
from datetime import datetime, timedelta, timezone

# ── Constants ──────────────────────────────────────────────────────────────────

SGT = timezone(timedelta(hours=8))
TMUX_SESSION = "claude/hermes"
TMUX_PANE = "0.0"
PROJECT_DIR = os.path.expanduser("~/project/au-electronic/au-electronic")
BASE_DIR = os.path.expanduser("~/.hermes/au-electronic")
LOGS_DIR = os.path.join(BASE_DIR, "logs")
REPORTS_DIR = os.path.join(BASE_DIR, "reports")
BACKLOG_DIR = os.path.join(BASE_DIR, "backlog")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
STATE_FILE = os.path.join(BASE_DIR, "state.json")
BACKLOG_FILE = os.path.join(BASE_DIR, "backlog.json")
SESSIONS_LOG = os.path.join(LOGS_DIR, "cron.log")
HANDOFF_FILE = os.path.join(BASE_DIR, "handoff.md")
MEMORY_FILE = os.path.join(BASE_DIR, "memory.md")
STANDING_RULES_FILE = os.path.join(BASE_DIR, "standing_rules.md")
LOCK_FILE = os.path.join(BASE_DIR, "sessions.lock")
SECRETS_FILE = os.path.join(BASE_DIR, "secrets.env")
STEERING_FILE = os.path.join(BASE_DIR, "steering.md")
UNDELIVERED_FILE = os.path.join(LOGS_DIR, "undelivered.md")

# LLM: shell out to hermes chat CLI (per spec: no external API, no hardcoded key)
HERMES_BIN = "hermes"
MODEL = "poolside/laguna-s-2.1:free"

# Timing
POLL_INTERVAL = 10  # seconds
BACKOFF_MAX = 60   # seconds
TASK_TIMEOUT_SHORT = 300  # dry-run task timeout
TASK_TIMEOUT_LONG = 600   # normal task timeout
WIND_DOWN_DURATION = 300  # 5 min before hard stop for wind-down
HARD_STOP_HOURS = 5.0     # 5-hour session limit

# CLI flags
DRY_RUN = False
NO_COMMIT = False
SHORT_HOURS = None


def parse_args():
    global DRY_RUN, NO_COMMIT, SHORT_HOURS
    for arg in sys.argv[1:]:
        if arg == "--dry-run":
            DRY_RUN = True
        elif arg == "--no-commit":
            NO_COMMIT = True
        elif arg.startswith("--short-hours="):
            SHORT_HOURS = float(arg.split("=", 1)[1])


def log(msg):
    """Append a timestamped line to the session log and stdout."""
    ts = datetime.now(SGT).strftime("%Y-%m-%d %H:%M:%S SGT")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    os.makedirs(LOGS_DIR, exist_ok=True)
    with open(SESSIONS_LOG, "a") as f:
        f.write(line + "\n")


def load_secrets():
    """Load secrets from the env file."""
    secrets = {}
    if os.path.exists(SECRETS_FILE):
        with open(SECRETS_FILE) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    secrets[k.strip()] = v.strip()
    return secrets


def get_api_token(force_refresh=False):
    """Deprecated: the cron agent no longer calls the inference API directly.

    Per the task spec ("Use your configured model — do not call an external
    API and do not hardcode a separate key"), LLM decisions are made by
    shelling out to the `hermes chat -q` CLI, which uses Hermes' own
    authenticated model routing. This shim is kept only so nothing explodes
    if referenced; it returns '' (callers must use llm_call, not the token).
    """
    return ""


def now_sgt():
    return datetime.now(SGT)


def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE) as f:
            return json.load(f)
    return {}


def save_state(state):
    state["last_update"] = now_sgt().isoformat()
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def load_json(path, default):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return default


def save_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def append_to_state_log(msg):
    """One-line entry to session log (not full transcript)."""
    log(msg)


# ── Locking ────────────────────────────────────────────────────────────────────

def acquire_lock():
    """Try to acquire the flock. Return file descriptor or None."""
    import fcntl
    fd = os.open(LOCK_FILE, os.O_RDWR | os.O_CREAT, 0o644)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return fd
    except (IOError, OSError):
        os.close(fd)
        # Check if the lock holder is still actually running
        # by trying to detect stale locks
        log("  Lock held. Checking if it's stale...")
        # Try to acquire with a tiny timeout to see if it clears
        try:
            fd2 = os.open(LOCK_FILE, os.O_RDWR | os.O_CREAT, 0o644)
            fcntl.flock(fd2, fcntl.LOCK_EX | fcntl.LOCK_NB)
            # It cleared - stale lock was released
            fd3 = os.open(LOCK_FILE, os.O_RDWR | os.O_CREAT, 0o644)
            fcntl.flock(fd3, fcntl.LOCK_EX | fcntl.LOCK_NB)
            log("  Stale lock cleared. Acquiring...")
            return fd3
        except (IOError, OSError):
            log("  Another session is actively running. Exiting.")
            return None


def release_lock(fd):
    import fcntl
    fcntl.flock(fd, fcntl.LOCK_UN)
    os.close(fd)


# ── LLM calls ──────────────────────────────────────────────────────────────────
#
# Per the task spec: "Use your configured model — do not call an external API
# and do not hardcode a separate key."  The cron agent shells out to the
# `hermes chat -q` CLI (quiet, programmatic mode) which uses Hermes' own
# authenticated model routing and handles token refresh automatically.
# We pass the system prompt as a prefix to the user query so the model
# respects it.

def _sanitize_for_llm(text):
    """Remove characters that can cause `hermes chat -q` to hang when passed
    as a command-line argument. Box-drawing characters (─, │, ┌, etc.) and
    certain UI glyphs trigger parsing issues in the CLI arg layer."""
    # Replace box-drawing / UI separator lines with plain text
    text = re.sub(r'─+', '', text)       # horizontal box drawing
    text = text.replace('│', '|')        # vertical box drawing
    text = re.sub(r'[┌┐└┘╓╗╙╝╠╣╦╩╬]', '+', text)  # box corners/junctions
    text = text.replace('━', '-').replace('┃', '|')  # heavy box drawing
    # Remove progress bar block characters (they're not meaningful to the model)
    # Keep the content but strip the bars
    return text


def llm_call(prompt, max_tokens=1024, system=""):
    """Call the configured model via `hermes chat -q`. Returns (text, cost).

    cost = {"prompt": N, "completion": N} — best-effort, parsed from the
    session footer that `hermes chat -q` emits; may be zeros if parsing fails.
    """
    import subprocess, re

    full_prompt = prompt
    if system:
        full_prompt = f"SYSTEM INSTRUCTIONS:\n{system}\n\nTASK:\n{prompt}"
    # Sanitize: box-drawing chars cause `hermes chat` CLI to hang when passed
    # as a command argument
    full_prompt = _sanitize_for_llm(full_prompt)

    cmd = [
        HERMES_BIN, "chat", "-q", full_prompt,
        "-Q",  # quiet: suppress banner/spinner, print only final response
        "-m", MODEL,
    ]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,
            env={**os.environ},
            stdin=subprocess.DEVNULL,
        )
        output = result.stdout
        # Strip the trailing session_id line if present
        lines = output.rsplit("\n", 1)
        if lines[-1].strip().startswith("session_id:"):
            output = lines[0]
        # Best-effort token parsing from output footer
        prompt_tokens = 0
        completion_tokens = 0
        usage_match = re.search(r"(?:Usage|Cost|tokens)[^\n]*?(\d+)", output, re.IGNORECASE)
        if usage_match:
            prompt_tokens = int(usage_match.group(1))

        return output.strip(), {"prompt": prompt_tokens, "completion": completion_tokens}
    except subprocess.TimeoutExpired:
        log("  LLM call timed out after 300s")
        return "[LLM timeout]", {"prompt": 0, "completion": 0}
    except Exception as e:
        log(f"  LLM call failed: {e}")
        return f"[LLM error: {e}]", {"prompt": 0, "completion": 0}


# ── tmux operations ─────────────────────────────────────────────────────────────

def tmux_send_keys(text):
    """Send text to the tmux pane (without Enter)."""
    subprocess.run(
        ["tmux", "send-keys", "-t", TMUX_SESSION, "-l", text],
        check=False
    )

def tmux_send_enter():
    """Send Enter to the tmux pane."""
    subprocess.run(
        ["tmux", "send-keys", "-t", TMUX_SESSION, "Enter"],
        check=False
    )

def tmux_capture(start_lines=50):
    """Capture pane output, last N lines."""
    result = subprocess.run(
        ["tmux", "capture-pane", "-p", "-S", f"-{start_lines}", "-t", TMUX_SESSION],
        capture_output=True, text=True
    )
    return result.stdout

def tmux_pane_alive():
    """Check if the tmux session/pane is alive."""
    result = subprocess.run(
        ["tmux", "list-panes", "-t", TMUX_SESSION, "-F", "#{pane_current_command}"],
        capture_output=True, text=True
    )
    return result.returncode == 0 and bool(result.stdout.strip())

def tmux_has_session():
    """Check if the claude/hermes session exists."""
    result = subprocess.run(
        ["tmux", "has-session", "-t", TMUX_SESSION],
        capture_output=True, text=True
    )
    return result.returncode == 0


def looks_ready(last_line, full_output):
    """
    Heuristic: detect if Claude Code is at a ready prompt.
    The prompt line is '❯ ' followed by optional text (command echo or suggestion)
    or just '❯' alone.
    The status bar follows the prompt (dashed line, stats, bypass info).
    """
    lines = full_output.strip().split('\n')

    # Look for the prompt line: '❯' followed by optional text
    for line in reversed(lines[-12:]):  # check last 12 lines (prompt sits between ─ lines)
        stripped = line.strip()
        # Claude Code prompt: ❯ followed by optional text
        if stripped.startswith('❯') or stripped == '❯':
            return True
        # Bash-style prompt
        if re.search(r'\$ ?$|# ?$', stripped):
            return True

    # Also check if the last non-status-bar line ends with prompt marker
    last_line = last_line.strip()
    if last_line.endswith('>') and '❯' not in last_line:
        # Could be bash prompt
        if not any(s in last_line for s in ['5h:', '7d:', 'bypass', 'resets', '┌', '└']):
            return True

    # Check for box-drawing ready markers on any recent line
    for line in lines[-5:]:
        stripped = line.strip()
        if stripped and any(m in stripped for m in ['┌', '└', '╰', '╭']) and '─' not in stripped:
            return True

    return False


def panel_has_error(output):
    """Detect genuine error patterns in pane output without an LLM call (§5).

    Refined to avoid false positives from Claude Code startup chatter or LLM
    retry messages (e.g., 'command too long', 'retrying in N seconds')."""
    lower = output.lower()
    # These patterns indicate a real error in the project being worked on
    error_patterns = [
        "error:", "fatal:", "command not found",
        "permission denied", "no such file or directory",
        "cannot start",
    ]
    # These are safe patterns that should NOT trigger an error detection
    false_positive_patterns = [
        "command too long",
        "retrying",
        "retry in",
        "attempt ",
        "api error",  # LLM retry messages
        "aborted",    # connection aborts in LLM chatter
        "claude code",
        "type / for",
        "esc to quit",
        "/clear",     # Claude command echoed through bash (not a real error)
    ]
    if any(fp in lower for fp in false_positive_patterns):
        return False
    return any(p in lower for p in error_patterns)


def launch_claude_code():
    """Launch Claude Code in the current tmux pane. Handles sandbox mode
    and TUI prompts (permission mode selection, etc)."""
    # Set IS_SANDBOX=1 to bypass root permission restrictions
    tmux_send_keys("export IS_SANDBOX=1")
    tmux_send_enter()
    time.sleep(1)

    # Launch claude without --dangerously-skip-permissions (blocked for root)
    # The IS_SANDBOX=1 env var enables bypass permissions via settings.json
    tmux_send_keys("claude")
    tmux_send_enter()
    time.sleep(15)  # Give Claude Code time to boot up

    # Handle TUI prompts during startup
    output = tmux_capture(start_lines=40)
    lines = output.strip().split('\n')

    # Check for permission mode TUI prompt
    if any("Make auto mode your default" in l for l in lines[-10:]):
        log("  Detected permission mode prompt. Selecting 'No, keep bypass permissions'...")
        tmux_send_keys("2")  # Option 2: No, keep bypass permissions
        tmux_send_enter()
        time.sleep(10)

    # Check for "auto mode on" notice that needs dismissal
    if any("auto mode on" in l.lower() for l in lines[-5:]):
        log("  Detected auto mode notice. Dismissing with Enter...")
        tmux_send_enter()
        time.sleep(3)

    # Re-check if we're at a ready prompt
    output = tmux_capture(start_lines=20)
    lines = output.strip().split('\n')
    return looks_ready(lines[-1] if lines else "", output), output


def ensure_claude_code_running(attempts=3):
    """Ensure Claude Code is running in the tmux pane. If not, start it."""
    # If the tmux session doesn't exist at all, create it
    if not tmux_has_session():
        log("  Creating tmux session claude/hermes...")
        # Start a new tmux session with bash, cd into the project dir
        subprocess.run(
            ["tmux", "new-session", "-d", "-s", TMUX_SESSION,
             "-c", PROJECT_DIR,
             "bash"],
            capture_output=True, text=True,
        )
        time.sleep(2)
        log("  tmux session created. Starting Claude Code...")
        ready, output = launch_claude_code()
        if ready:
            log("  Claude Code started and is ready.")
            return True
        if panel_has_error(output):
            log("  Claude Code may have errored during startup. Continuing...")

    for attempt in range(1, attempts + 1):
        log(f"  Checking if Claude Code is running (attempt {attempt}/{attempts})...")

        # Capture recent pane output to see if Claude's at a ready prompt
        output = tmux_capture(start_lines=20)
        lines = output.strip().split('\n')

        # Check if Claude Code is already running and at a ready prompt
        if looks_ready(lines[-1] if lines else "", output):
            log("  Claude Code is already running and at a ready prompt.")
            return True

        # Check if claude process is running (even if not at prompt)
        claude_proc = subprocess.run(
            ["pgrep", "-f", r"claude.*session-id\|versions.*claude"],
            capture_output=True, text=True
        )
        if claude_proc.returncode == 0:
            log("  Claude Code process is running. Waiting for ready prompt...")
            time.sleep(5)
            output = tmux_capture(start_lines=20)
            lines = output.strip().split('\n')
            if looks_ready(lines[-1] if lines else "", output):
                log("  Claude Code is at a ready prompt.")
                return True

        # If not running, start it
        log("  Starting Claude Code...")

        # Check if session exists first (just the tmux session, not necessarily Claude)
        if not tmux_has_session():
            log("  tmux session missing. Recreating...")
            subprocess.run(
                ["tmux", "new-session", "-d", "-s", TMUX_SESSION,
                 "-c", PROJECT_DIR, "bash"],
                capture_output=True, text=True,
            )
            time.sleep(2)

        ready, output = launch_claude_code()
        if ready:
            log("  Claude Code started and is ready.")
            return True
        elif panel_has_error(output):
            log("  Claude Code may have errored. Retrying...")
        else:
            log("  Waiting for Claude Code to initialize...")
            time.sleep(10)

    log("  ERROR: Could not start Claude Code after all attempts.")
    return False


def _strip_status_bar(output):
    """Remove Claude Code status bar lines (countdown timer, ctx bar, branch info).
    The status bar is the last few lines containing '5h:', '7d:', 'ctx:', or
    'bypass'. This preserves the prompt line ('❯ ...') which sits between two
    '─' separator lines just above the status bar."""
    lines = output.split('\n')
    if len(lines) <= 5:
        return output
    status_bar_patterns = ['5h:', '7d:', 'ctx:', 'bypass', 'resets']
    # Scan from bottom: skip blank lines, collect status-bar lines, then
    # skip the trailing '─' separator and the prompt line (❯ ...), then stop.
    i = len(lines) - 1
    # Skip trailing blanks
    while i >= 0 and not lines[i].strip():
        i -= 1
    # Walk up through status bar + separators + prompt line
    while i >= 0:
        stripped = lines[i].strip()
        if not stripped:
            i -= 1
            continue
        if any(p in stripped for p in status_bar_patterns):
            i -= 1
            continue
        elif re.match(r'^─+$', stripped):
            # Separator line — this is the bottom of the status bar box.
            # One more '─' above is the box top; between them is the prompt.
            i -= 1
            # The prompt line (❯ ...)
            if i >= 0 and lines[i].strip().startswith('❯'):
                i -= 1
            # The top ─ separator
            if i >= 0 and re.match(r'^─+$', lines[i].strip()):
                i -= 1
            break
        elif stripped.startswith('kevj-github') or stripped.startswith('au-electronic'):
            i -= 1
            continue
        else:
            break
    return '\n'.join(lines[:i+1]) if i >= 0 else output


def wait_for_idle(timeout=300):
    """
    Poll the pane until it's idle at a ready prompt.
    Uses cheap polling (no LLM) per §5.
    Returns (output, success).
    """
    last_output = None
    identical_count = 0
    poll_interval = POLL_INTERVAL
    start = time.time()
    last_poke_time = 0

    while time.time() - start < timeout:
        current = tmux_capture(start_lines=80)
        current_normalized = _strip_status_bar(current)

        if current_normalized == last_output:
            identical_count += 1
            if identical_count >= 3:
                last_line = current.strip().split('\n')[-1] if current.strip() else ""
                if looks_ready(last_line, current):
                    if "session limit" in current.lower() or "rate limit" in current.lower():
                        log("  Note: Claude Code shows session/rate limit warning, but is at ready prompt.")
                    return current, True

            # Periodically poke Claude to force status bar refresh
            # The 5h/7d/ctx bars can be stale — sending Enter forces a refresh
            elapsed = time.time() - start
            if elapsed - last_poke_time > 50 and poll_interval >= BACKOFF_MAX * 0.8:
                log("  Poking Claude to refresh status bar...")
                tmux_send_keys(" ")  # harmless space keystroke
                last_poke_time = elapsed
                time.sleep(3)
                # Re-capture after poke
                current = tmux_capture(start_lines=80)
                current_normalized = _strip_status_bar(current)

            # Still identical but not yet 3 — use backoff
            poll_interval = min(poll_interval * 1.5, BACKOFF_MAX)
        else:
            identical_count = 0
            last_output = current_normalized
            poll_interval = POLL_INTERVAL  # Reset to base interval when output changes

        time.sleep(poll_interval)

    return tmux_capture(start_lines=80), False


def _should_clear_context(output):
    """Detect if Claude's context usage is getting too high (> 75%)."""
    match = re.search(r'ctx:\[.*?\].*?(\d+(?:\.\d+)?)%', output)
    if match:
        pct = float(match.group(1))
        return pct > 75
    return False


# ── Telegram operations ────────────────────────────────────────────────────────
# The Hermes gateway service (hermes-gateway.service) owns long-polling
# (getUpdates) on this bot permanently. The cron agent does NOT poll. It only:
#   1) sends messages (plain POST, no conflict),
#   2) reads a steering.md file drop for human instructions.
# This avoids the dual-poller Conflict error and the sender-auth problem.

import urllib.request
import urllib.parse
import urllib.error

TELEGRAM_API_BASE = "https://api.telegram.org/bot"


def load_secrets():
    """Load secrets from secrets.env file (KEY=value format)."""
    secrets = {}
    if os.path.exists(SECRETS_FILE):
        with open(SECRETS_FILE) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, val = line.partition("=")
                    secrets[key.strip()] = val.strip()
    return secrets


def _telegram_request(method: str, token: str, payload: dict, timeout: int = 15) -> dict:
    """Make a single Telegram API request via urllib (no curl, no token on cmdline).

    Uses POST with form-encoded body so the token is never visible in `ps` or `/proc/<pid>/cmdline`.
    Returns the parsed JSON response dict."""
    url = f"{TELEGRAM_API_BASE}{token}/{method}"
    data = urllib.parse.urlencode(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def telegram_send_message(text, retries: int = 2):
    """Send a message to the configured Telegram chat.

    Verifies the response `ok` field, retries twice with backoff on failure,
    and falls back to undelivered.md if all attempts fail.
    Returns the final parsed response dict, or None on total failure.
    """
    secrets = load_secrets()
    token = secrets.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = secrets.get("TELEGRAM_CHAT_ID", "")
    if not token or not chat_id:
        log("  [telegram] ERROR: Missing bot token or chat ID")
        return None

    payload = {"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}

    last_error = None
    for attempt in range(retries + 1):
        try:
            data = _telegram_request("sendMessage", token, payload)
            if data.get("ok"):
                log("  [telegram] Message sent successfully.")
                return data
            else:
                last_error = data
                desc = data.get("description", "unknown")
                code = data.get("error_code", "?")
                log(f"  [telegram] Send failed (ok=false): code={code} desc={desc[:200]}")
        except urllib.error.URLError as e:
            last_error = {"error": str(e)}
            log(f"  [telegram] Network error (attempt {attempt + 1}/{retries + 1}): {e}")
        except Exception as e:
            last_error = {"error": str(e)}
            log(f"  [telegram] Unexpected error (attempt {attempt + 1}/{retries + 1}): {e}")

        if attempt < retries:
            backoff = min(2 ** (attempt + 1), 10)  # 2s, then 4s
            time.sleep(backoff)

    # All retries failed — write to undelivered.md fallback
    log(f"  [telegram] ERROR: All {retries + 1} send attempts failed. Falling back to undelivered.md")
    try:
        os.makedirs(LOGS_DIR, exist_ok=True)
        timestamp = now_sgt().strftime("%Y-%m-%d %H:%M:%S")
        with open(UNDELIVERED_FILE, "a") as f:
            f.write(f"## Undelivered message — {timestamp}\n\n```\n{text}\n```\n\n**Error:** {json.dumps(last_error)[:300]}\n\n")
        log(f"  [telegram] Message written to {UNDELIVERED_FILE}")
    except Exception as e:
        log(f"  [telegram] FATAL: Could not write to undelivered.md: {e}")

    return None


def read_steering():
    """Read human instructions from steering.md file drop.

    The human writes free-text instructions directly on the VPS to
    ~/.hermes/au-electronic/steering.md. We apply them and clear the file.

    Returns list of instruction strings (may be empty)."""
    instructions = []
    if os.path.exists(STEERING_FILE):
        try:
            with open(STEERING_FILE) as f:
                content = f.read().strip()
            if content:
                # Split into individual instructions (non-empty lines)
                instructions = [line.strip() for line in content.split("\n") if line.strip()]
                # Clear the file after reading (one-shot application)
                with open(STEERING_FILE, "w") as f:
                    f.write("")
                log(f"  Steering: read {len(instructions)} instruction(s) from steering.md")
        except Exception as e:
            log(f"  [steering] Error reading steering.md: {e}")
    return instructions


def send_undelivered_to_telegram():
    """Attempt to flush undelivered.md messages on a subsequent session."""
    if not os.path.exists(UNDELIVERED_FILE):
        return 0
    try:
        with open(UNDELIVERED_FILE) as f:
            content = f.read()
        if not content.strip():
            return 0
        # Send as a single message
        summary = "⚠️ **Cron agent — undelivered messages from prior session:**\n\n" + content
        result = telegram_send_message(summary)
        if result and result.get("ok"):
            # Clear after successful send
            os.remove(UNDELIVERED_FILE)
            log("  [telegram] Undelivered backlog flushed successfully.")
            return 1
        else:
            log("  [telegram] Failed to flush undelivered backlog.")
            return 0
    except Exception as e:
        log(f"  [telegram] Error flushing undelivered.md: {e}")
        return 0


# ── Git operations ─────────────────────────────────────────────────────────────

def git_sync_main_into_hermes():
    """Create or fast-forward the 'hermes' branch from 'main'.
    Aborts if there are uncommitted changes on hermes."""
    log("  Syncing branch: hermes ← main...")
    try:
        # Check for uncommitted changes
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True, text=True,
            cwd=PROJECT_DIR
        )
        if result.stdout.strip():
            log(f"  Auto-committing pending changes before sync: {result.stdout.strip()[:100]}")
            subprocess.run(["git", "add", "-A"], capture_output=True, text=True, cwd=PROJECT_DIR)
            subprocess.run(["git", "commit", "-m", "chore: auto-commit pending changes from previous session"],
                          capture_output=True, text=True, cwd=PROJECT_DIR)

        # Check if hermes branch exists
        result = subprocess.run(
            ["git", "rev-parse", "--verify", "hermes"],
            capture_output=True, text=True,
            cwd=PROJECT_DIR
        )
        if result.returncode == 0:
            # hermes exists — check it's clean and merge main
            subprocess.run(["git", "checkout", "hermes"], capture_output=True, text=True, cwd=PROJECT_DIR)
            merge_result = subprocess.run(
                ["git", "merge", "origin/main", "--no-edit", "--ff-only"],
                capture_output=True, text=True,
                cwd=PROJECT_DIR
            )
            if merge_result.returncode != 0:
                log("  Non-fast-forward merge or conflict. Aborting.")
                log(f"  {merge_result.stderr.strip()[:200]}")
                return False
            log("  Branch synced: hermes ← main (fast-forward)")
            return True
        else:
            # Create hermes from main
            subprocess.run(["git", "checkout", "-b", "hermes", "main"], capture_output=True, text=True, cwd=PROJECT_DIR)
            log("  Branch synced: hermes ← main (new branch)")
            return True
    except Exception as e:
        log(f"  Git sync error: {e}")
        return False


def git_commit_and_push():
    """Commit changes on hermes branch and push, open PR to main."""
    if NO_COMMIT:
        log("  Skipping commit/push (--no-commit flag)")
        return
    log("  Committing and pushing changes...")
    try:
        # Stage all
        subprocess.run(["git", "add", "-A"], capture_output=True, text=True, cwd=PROJECT_DIR)
        # Commit
        result = subprocess.run(
            ["git", "commit", "-m", "hermes: daily improvements"],
            capture_output=True, text=True,
            cwd=PROJECT_DIR
        )
        if result.returncode != 0:
            log(f"  Commit may have failed (possibly no changes): {result.stderr.strip()[:200]}")
            return
        # Push
        push_result = subprocess.run(
            ["git", "push", "-u", "origin", "hermes"],
            capture_output=True, text=True,
            cwd=PROJECT_DIR
        )
        if push_result.returncode == 0:
            log("  Pushed hermes branch to origin.")
        else:
            log(f"  Push failed: {push_result.stderr.strip()[:200]}")
            return

        # Open PR
        pr_result = subprocess.run(
            ["gh", "pr", "create", "--base", "main", "--head", "hermes",
             "--title", "hermes: daily improvements",
             "--body", "Automated daily improvement cycle from hermes-agent cron."],
            capture_output=True, text=True,
            cwd=PROJECT_DIR
        )
        if pr_result.returncode == 0:
            log("  PR created: " + pr_result.stdout.strip()[:200])
        else:
            log(f"  PR creation note: {pr_result.stderr.strip()[:200]}")
    except Exception as e:
        log(f"  Git commit/push error: {e}")


# ── Backlog operations ─────────────────────────────────────────────────────────

def load_backlog():
    return load_json(BACKLOG_FILE, [])


def save_backlog(backlog):
    save_json(BACKLOG_FILE, backlog)


def append_to_file(path, text):
    """Append text to a file, creating parent dirs if needed."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a") as f:
        f.write(text)


def get_next_task(backlog):
    """Get the highest-priority open task."""
    open_items = [b for b in backlog if b.get("status") == "open"]
    if not open_items:
        return None
    open_items.sort(key=lambda x: x.get("priority", 999))
    return open_items[0]


# ── Memory & Handoff ───────────────────────────────────────────────────────────

def build_boot_message(memory, handoff, backlog, item):
    """Build the boot message that gives Claude context for this session."""
    msg = "=== Au-Electronic Daily Session Boot ===\n\n"

    if os.path.exists(MEMORY_FILE):
        with open(MEMORY_FILE) as f:
            memory = f.read().strip()
    if memory:
        msg += f"## Previous Session Memory\n{memory}\n\n"

    if os.path.exists(HANDOFF_FILE):
        with open(HANDOFF_FILE) as f:
            handoff = f.read().strip()
    if handoff:
        msg += f"## Last Session Handoff\n{handoff}\n\n"

    if os.path.exists(STANDING_RULES_FILE):
        with open(STANDING_RULES_FILE) as f:
            rules = f.read().strip()
        msg += f"## Standing Rules\n{rules}\n\n"

    if item:
        msg += f"## Task #{item.get('id')}: {item.get('title')}\n"
        msg += f"# Priority: {item.get('priority', 'N/A')}\n"
        if item.get("notes"):
            msg += f"# Notes: {item.get('notes', '')}\n"
        msg += "\n# Please work on this task. Report back when done with a summary.\n"

    return msg


def build_task_prompt(item):
    """Build the prompt to send to Claude for a specific task."""
    msg = f"## Task #{item.get('id')}: {item.get('title')}\n\n"
    msg += f"# Priority: {item.get('priority', 'N/A')}\n\n"
    if item.get("notes"):
        msg += f"# Notes:\n{item.get('notes', '')}\n\n"
    if item.get("description"):
        msg += f"# Description:\n{item.get('description', '')}\n\n"
    msg += "# Please work on this task now. When you believe you're done, summarize what you did and any findings.\n"
    return msg


def build_wind_down_prompt(state, completed_items, pending_items):
    """Build the wind-down / context-reset prompt."""
    msg = "=== Wind Down: Session Summary ===\n\n"
    msg += f"Session started: {state.get('session_start', 'unknown')}\n"
    msg += f"Session ID: {state.get('session_id', 'unknown')}\n\n"

    if completed_items:
        msg += "## Completed Tasks\n"
        for item in completed_items:
            msg += f"- #{item.get('id')}: {item.get('title')}\n"
        msg += "\n"

    if pending_items:
        msg += "## Pending Tasks\n"
        for item in pending_items:
            msg += f"- #{item.get('id')}: {item.get('title')} (priority: {item.get('priority', 'N/A')})\n"
        msg += "\n"

    msg += "Please provide a concise summary of what you accomplished this session, "
    msg += "any blockers encountered, and what the next session should focus on. "
    msg += "Keep it to 3-5 lines.\n"

    return msg


def write_handoff(summary):
    """Write the handoff.md file for the next session."""
    with open(HANDOFF_FILE, "w") as f:
        f.write(f"# Session Handoff\n\n")
        f.write(f"**Date (SGT):** {now_sgt().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write(f"## Summary\n{summary}\n")


def update_memory(claude_output, item):
    """Append key findings to memory.md."""
    with open(MEMORY_FILE, "a") as f:
        f.write(f"\n--- Task #{item.get('id')} ({now_sgt().strftime('%Y-%m-%d')}) ---\n")
        f.write(f"Task: {item.get('title', 'unknown')}\n")
        f.write(f"Output snippet:\n{claude_output[:500]}\n")


# ── Telegram steering ───────────────────────────────────────────────────────────
# (Removed: check_telegram_steering / getUpdates polling. The Hermes gateway
# owns long-polling. Human instructions come from steering.md file drops,
# read by read_steering() above.)


# ── Main Agent Class ───────────────────────────────────────────────────────────

class AuElectronicCronAgent:
    """Main orchestrator for the au-electronic daily improvement cron agent."""

    def __init__(self):
        self.state = load_state()
        self.backlog = load_backlog()
        self.lock_fd = None
        self.start_time = None
        self.hard_stop = None
        self.wind_down = None
        self.session_id = None
        self.llm_cost = {"prompt": 0, "completion": 0}
        self.completed_items = []

    def log(self, msg):
        log(msg)

    def within_time(self):
        """Check if we're within the hard-stop window."""
        if SHORT_HOURS:
            hard = self.start_time + timedelta(hours=SHORT_HOURS)
        else:
            hard = self.start_time + timedelta(hours=HARD_STOP_HOURS)
        return datetime.now(SGT) < hard

    def should_wind_down(self):
        """Check if we should enter wind-down phase."""
        hours = SHORT_HOURS if SHORT_HOURS else HARD_STOP_HOURS
        wind_down_minutes = WIND_DOWN_DURATION / 60  # 5 minutes
        wd = self.start_time + timedelta(hours=hours) - timedelta(minutes=wind_down_minutes)
        return datetime.now(SGT) >= wd

    def run(self):
        """Main entry point for the cron agent."""
        parse_args()
        self.session_id = datetime.now(SGT).strftime("%Y%m%d_%H%M%S")
        self.start_time = datetime.now(SGT)

        if SHORT_HOURS:
            self.hard_stop = self.start_time + timedelta(hours=SHORT_HOURS)
            self.wind_down = self.hard_stop - timedelta(minutes=2)
        else:
            self.hard_stop = self.start_time + timedelta(hours=HARD_STOP_HOURS)
            self.wind_down = self.hard_stop - timedelta(minutes=10)

        log("=" * 70)
        log(f"Au-electronic daily improvement session starting")
        log(f"Session ID: {self.session_id}")
        window = SHORT_HOURS if SHORT_HOURS else HARD_STOP_HOURS
        log(f"Hard stop: {self.hard_stop.strftime('%H:%M SGT')} ({window}h window)")
        log(f"Wind down at: {self.wind_down.strftime('%H:%M SGT')}")
        log(f"Dry run: {DRY_RUN}")
        log("=" * 70)

        try:
            # Phase 0: Start
            if not self.phase_0_start():
                log("Phase 0 failed. Aborting.")
                return

            # Phase 1: Work loop
            self.phase_1_work_loop()

            # Phase 2: Wind down & context reset
            self.phase_2_wind_down()

            # Phase 3: Report
            self.phase_3_report()

        finally:
            # Always clean up — release lock and remove lock file
            # Even if the process is killed (SIGTERM/SIGINT)
            if self.lock_fd:
                release_lock(self.lock_fd)
                self.lock_fd = None
                try:
                    os.unlink(LOCK_FILE)
                except OSError:
                    pass

        log("=" * 70)
        log("Session complete.")
        log(f"Tasks completed: {len(self.completed_items)}")
        log("=" * 70)

    def reset_stale_backlog_items(self):
        """Reset stale items from previous sessions to open/needs_human.

        Logic (P0-2):
        - in_progress with started_at predating this session → reset to open,
          increment attempts, preserve notes.
        - stall or error → reset to open once; on second encounter → needs_human.
        - attempts >= 3 → needs_human (don't loop forever).
        """
        reset_items = []
        needs_human_items = []

        for item in self.backlog:
            status = item.get("status", "open")
            attempts = item.get("attempts", 0)
            started_at_str = item.get("started_at", "")

            # Parse started_at to check if it predates this session
            is_stale = False
            if started_at_str:
                try:
                    started_at = datetime.fromisoformat(started_at_str)
                    if started_at < self.start_time:
                        is_stale = True
                except (ValueError, TypeError):
                    is_stale = True  # unparseable timestamp → treat as stale

            if status == "in_progress" and is_stale:
                # Reset in_progress from a previous session
                item["status"] = "open"
                item["attempts"] = attempts + 1
                item["reset_reason"] = f"stale in_progress reset at {self.session_id}"
                reset_items.append((item.get("id"), "in_progress", "open"))
                log(f"  Reset stale item #{item.get('id')} (in_progress → open, attempt {item['attempts']})")

            elif status in ("stall", "error") and is_stale:
                # Reset stall/error items — once to open, second time to needs_human
                already_reset = item.get("_reset_count", 0)
                if already_reset >= 1:
                    item["status"] = "needs_human"
                    item["needs_human_reason"] = f"Failed {attempts} times: {status}"
                    needs_human_items.append(item)
                    log(f"  Item #{item.get('id')} marked needs_human (was {status}, already reset)")
                else:
                    item["_reset_count"] = 1
                    item["status"] = "open"
                    item["attempts"] = attempts + 1
                    reset_items.append((item.get("id"), status, "open"))
                    log(f"  Reset stale item #{item.get('id')} ({status} → open, attempt {item['attempts']})")

            # Guard: cap at 3 total attempts regardless of path
            if item.get("attempts", 0) >= 3 and status != "done" and status != "needs_human":
                item["status"] = "needs_human"
                item["needs_human_reason"] = f"Exceeded max attempts: {item.get('attempts', 0)}"
                needs_human_items.append(item)
                log(f"  Item #{item.get('id')} exceeded 3 attempts → needs_human")

            # Clear started_at when resetting to open so it reflects next attempt
            if status == "open" and item.get("started_at"):
                if item.get("_reset_count", 0) > 0 or item.get("attempts", 0) > 0:
                    pass  # preserve context for retry
                else:
                    item.pop("started_at", None)

        if reset_items or needs_human_items:
            log(f"  Stale item reset: {len(reset_items)} reset to open, {len(needs_human_items)} → needs_human")
            save_backlog(self.backlog)
        else:
            log("  No stale backlog items to reset.")

    def phase_0_start(self):
        """Phase 0: Acquire lock, sync branch, check Telegram, ensure Claude."""
        log("--- Phase 0: Start ---")

        # Acquire lock
        self.lock_fd = acquire_lock()
        if self.lock_fd is None:
            log("  Another session is already running (lock held). Exiting.")
            return False
        log("  Lock acquired (sessions.lock).")

        # Reset stale items from previous sessions (P0-2)
        self.reset_stale_backlog_items()

        # Warm-up LLM call to prime auth session (avoids cold-start timeout)
        log("  Warming up LLM session...")
        _, _ = llm_call("Reply with: ready", max_tokens=5)
        log("  LLM session ready.")

        # Save state
        self.state["phase"] = "phase_0"
        self.state["session_id"] = self.session_id
        self.state["session_start"] = self.start_time.isoformat()
        self.state["hard_stop"] = self.hard_stop.isoformat()
        self.state["wind_down"] = self.wind_down.isoformat()
        save_state(self.state)

        # Sync branch hermes <- main
        if not git_sync_main_into_hermes():
            log("  Git sync failed.")
            return False

        # Check for human steering instructions (file drop, not Telegram polling)
        instructions = read_steering()
        # Flush any undelivered Telegram messages from a prior session
        send_undelivered_to_telegram()
        for instr in instructions:
            self._apply_steering(instr)

        # Ensure Claude Code is running
        if not ensure_claude_code_running():
            log("  ERROR: Claude Code not available. Aborting.")
            return False

        # Check context usage
        output = tmux_capture(start_lines=20)
        if _should_clear_context(output):
            log("  Context usage > 75%. Clearing context with /clear...")
            tmux_send_keys("/clear")
            tmux_send_enter()
            time.sleep(3)
            ensure_claude_code_running()
        else:
            log("  Context usage is acceptable.")

        # Send boot message
        boot_msg = build_boot_message("", "", "", get_next_task(self.backlog))
        if get_next_task(self.backlog):
            log(f"  Sending boot message to Claude (task #{get_next_task(self.backlog).get('id')})...")
        else:
            log("  Sending boot message to Claude...")
        tmux_send_keys(boot_msg)
        tmux_send_enter()

        # Wait for acknowledgment (timeout depends on dry-run)
        boot_timeout = 300
        output, success = wait_for_idle(timeout=boot_timeout)
        if not success:
            log("  WARNING: Claude did not acknowledge boot message within timeout.")
            # Proceed anyway — Claude may still be processing
        else:
            log("  Claude Code acknowledged boot message.")

        self.state["phase"] = "phase_1"
        save_state(self.state)
        return True

    def phase_1_work_loop(self):
        """Phase 1: Execute tasks from the backlog."""
        log("--- Phase 1: Work loop ---")

        while self.within_time() and not self.should_wind_down():
            item = get_next_task(self.backlog)
            if not item:
                log("  No open tasks in backlog. Session complete.")
                break

            log(f"  Working on item #{item.get('id')}: {item.get('title', '')[:60]} (priority: {item.get('priority', 'N/A')})")

            # Update item status to in_progress
            item["status"] = "in_progress"
            item["started_at"] = now_sgt().isoformat()
            save_backlog(self.backlog)

            # Send task prompt
            prompt = build_task_prompt(item)
            tmux_send_keys(prompt)
            tmux_send_enter()

            # Wait for completion
            task_timeout = 420 if DRY_RUN else 600
            output, idle = wait_for_idle(timeout=task_timeout)

            if not idle:
                log("  Task timed out or stalled. Checking output...")
                # Use LLM to interpret what happened
                interpretation = self._interpret_output_for_item(item, output)
                if "done" in interpretation.get("status", "").lower() or "complete" in interpretation.get("status", "").lower():
                    item["status"] = "done"
                    self.completed_items.append(item)
                elif "stall" in interpretation.get("status", "").lower():
                    item["status"] = "stall"
                    log(f"  Item marked as STALL: {interpretation.get('reason', '')}")
                    telegram_send_message(f"⚠️ Task #{item.get('id')} stalled: {interpretation.get('reason', '')[:200]}")
                else:
                    item["status"] = "stall"
                    log(f"  Item inconclusive, marking as stall.")
                item["completed_at"] = now_sgt().isoformat()
                save_backlog(self.backlog)
                continue

            # Check for errors
            if panel_has_error(output):
                log("  Detected errors in pane output.")
                item["status"] = "error"
                item["error_output"] = output[-500:]
                self.completed_items.append(item)
                continue

            # Use LLM to verify completion and interpret output
            result = self._verify_completion(item, output)
            if result.get("status") == "done":
                log(f"  Item #{item.get('id')} marked as DONE.")
                item["status"] = "done"
                item["completion_summary"] = result.get("summary", "")
                self.completed_items.append(item)
                update_memory(output[-300:], item)
            elif result.get("status") == "needs_work":
                log(f"  Item #{item.get('id')} needs more work: {result.get('reason', '')[:100]}")
                item["status"] = "open"  # back to open for retry
                # Send follow-up prompt
                follow_up = f"## Re-task: #{item.get('id')}\n{result.get('reason', '')}\n\nPlease address this."
                tmux_send_keys(follow_up)
                tmux_send_enter()
                # Wait again
                output2, idle2 = wait_for_idle(timeout=240 if DRY_RUN else 480)
                result2 = self._verify_completion(item, output2)
                item["status"] = "done" if result2.get("status") == "done" else "stall"
                if item["status"] == "done":
                    self.completed_items.append(item)
                else:
                    telegram_send_message(f"⚠️ Task #{item.get('id')} needs human attention: {result2.get('reason', '')[:200]}")
            else:
                item["status"] = "stall"
                log(f"  Item marked as STALL: {result.get('reason', '')}")

            item["completed_at"] = now_sgt().isoformat()
            save_backlog(self.backlog)

            # Check for new steering instructions during work (file drop)
            for instr in read_steering():
                self._apply_steering(instr)

        log("  Phase 1 complete.")

    def _interpret_output_for_item(self, item, output):
        """Use LLM to interpret Claude's output and determine task status."""
        prompt = (
            f"You are a task completion checker. Claude Code was working on:\n"
            f"Task: {item.get('title', '')}\n"
            f"Output:\n{output[-500:]}\n\n"
            f"Determine if the task is DONE, NEEDS_WORK, or STALLED.\n"
            f"Return ONLY valid JSON, no other text. Example: {{\"status\": \"done\", \"reason\": \"tests passed\"}}\n"
        )
        text, cost = llm_call(prompt, max_tokens=512, system="Return ONLY valid JSON. No prose, no markdown.")
        self.llm_cost["prompt"] += cost.get("prompt", 0)
        self.llm_cost["completion"] += cost.get("completion", 0)
        try:
            result = json.loads(text)
            return result
        except (json.JSONDecodeError, TypeError):
            # Fallback: keyword-based detection from free text
            lower = text.lower()
            if any(k in lower for k in ["done", "complete", "passed", "success", "finished", "all tests"]):
                return {"status": "done", "reason": "Detected completion via keyword fallback"}
            elif any(k in lower for k in ["needs", "work", "retry"]):
                return {"status": "needs_work", "reason": "Detected need for more work via keyword fallback"}
            else:
                return {"status": "stall", "reason": f"LLM response (non-JSON): {text[:200]}"}

    def _verify_completion(self, item, output):
        """Use LLM to verify that a task is truly complete."""
        prompt = (
            f"You are a task completion verifier. Claude Code worked on:\n"
            f"Task: {item.get('title', '')}\n"
            f"Output (last part):\n{output[-500:]}\n\n"
            f"Verify if the task is truly DONE. Return ONLY valid JSON. Example: {{\"status\": \"done\", \"reason\": \"tests passed\", \"summary\": \"...\"}}\n"
        )
        text, cost = llm_call(prompt, max_tokens=512, system="Return ONLY valid JSON. No prose, no markdown.")
        self.llm_cost["prompt"] += cost.get("prompt", 0)
        self.llm_cost["completion"] += cost.get("completion", 0)
        try:
            result = json.loads(text)
            return result
        except (json.JSONDecodeError, TypeError):
            # Fallback: keyword-based detection
            lower = text.lower()
            if any(k in lower for k in ["done", "complete", "passed", "success", "finished", "all tests"]):
                return {"status": "done", "reason": "Verified via keyword fallback", "summary": text[:200]}
            else:
                return {"status": "stall", "reason": f"LLM response (non-JSON): {text[:200]}", "summary": text[:200]}

    def phase_2_wind_down(self):
        """Phase 2: Wind down — summarize, clear context, prepare handoff."""
        log("--- Phase 2: Wind down ---")

        # Build wind-down prompt
        open_items = [b for b in self.backlog if b.get("status") == "open"]
        wind_msg = build_wind_down_prompt(
            {"session_start": self.start_time.isoformat(), "session_id": self.session_id},
            self.completed_items,
            open_items
        )
        tmux_send_keys(wind_msg)
        tmux_send_enter()

        output, success = wait_for_idle(timeout=120)

        # Use LLM to generate a concise handoff summary
        summary_prompt = (
            f"Summarize this Claude Code session output into a concise handoff (2-3 lines):\n"
            f"{output[-500:]}"
        )
        summary, _ = llm_call(summary_prompt, max_tokens=256, system="Keep it to 2-3 lines.")
        write_handoff(summary)

        # Clear context
        log("  Clearing Claude context (/clear)...")
        tmux_send_keys("/clear")
        tmux_send_enter()
        time.sleep(3)

        self.state["phase"] = "phase_3"
        save_state(self.state)

    def phase_3_report(self):
        """Phase 3: Generate and send final report."""
        log("--- Phase 3: Report ---")

        # Generate report via LLM
        report_prompt = (
            f"Generate a concise daily report for the au-electronic cron agent session.\n"
            f"Session ID: {self.session_id}\n"
            f"Tasks completed: {len(self.completed_items)}\n"
            f"Completed items: {json.dumps([i.get('title', '') for i in self.completed_items])}\n"
            f"LLM cost: {json.dumps(self.llm_cost)}\n\n"
            f"Format as a brief summary (3-5 lines)."
        )
        report, _ = llm_call(report_prompt, max_tokens=512)
        log(f"  Report: {report[:200]}")

        # Save report
        os.makedirs(REPORTS_DIR, exist_ok=True)
        report_file = os.path.join(REPORTS_DIR, f"report_{self.session_id}.md")
        with open(report_file, "w") as f:
            f.write(f"# Daily Report — {self.session_id}\n\n")
            f.write(f"**Date (SGT):** {now_sgt().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write(report)
            f.write(f"\n\n**Tasks completed:** {len(self.completed_items)}\n")
            for item in self.completed_items:
                f.write(f"- #{item.get('id')}: {item.get('title', '')} — {item.get('status', '')}\n")
            # Surface needs_human items
            needs_human = [b for b in self.backlog if b.get("status") == "needs_human"]
            if needs_human:
                f.write(f"\n**Needs human attention:** {len(needs_human)}\n")
                for item in needs_human:
                    f.write(f"- #{item.get('id')}: {item.get('title', '')}\n")

        # ALWAYS send the daily report via Telegram — every session, no exception
        # (previously only stalled/error sessions were messaged, which is why
        # the user never received a message on successful runs)
        open_items = [b for b in self.backlog if b.get("status") == "open"]
        needs_human = [b for b in self.backlog if b.get("status") == "needs_human"]
        if needs_human or open_items:
            status_emoji = "⚠️"
            extra = f"Open: {len(open_items)}\nNeeds human: {len(needs_human)}\n"
        else:
            status_emoji = "✅"
            extra = ""

        result = telegram_send_message(
            f"{status_emoji} Cron session {self.session_id} complete.\n"
            f"Tasks completed: {len(self.completed_items)}\n"
            f"{extra}"
            f"Report: {report[:300]}"
        )
        if not result or not result.get("ok"):
            # Check if we have a saved report we can reference
            log(f"  Report saved to reports/report_{self.session_id}.md")
            log("  WARNING: Telegram delivery may have failed — see undelivered.md")

    def _apply_steering(self, instruction):
        """Apply a human-written steering instruction from steering.md.

        Supported directives (case-insensitive, substring match):
          - 'stop' / 'cancel': abort the session immediately
          - 'skip task <N>': mark task N as skipped
          - 'add task <desc>': append a new task parsed by LLM
          - Anything else: logged as a note in memory.md
        No untrusted input from Telegram reaches the agent — the human writes
        directly on the VPS filesystem."""
        lower = instruction.lower().strip()
        if "stop" in lower or "cancel" in lower:
            log("  Steering: STOP command received. Aborting session.")
            telegram_send_message("🛑 Cron session aborted by steering.md STOP command.")
            sys.exit(0)
        elif "skip" in lower:
            log("  Steering: SKIP command received.")
            m = re.search(r"#?(\d+)", instruction)
            if m:
                task_id = int(m.group(1))
                for item in self.backlog:
                    if item.get("id") == task_id:
                        item["status"] = "skipped"
                        log(f"  Task #{task_id} marked skipped.")
                        save_backlog(self.backlog)
        elif "add" in lower and "task" in lower:
            log("  Steering: ADD task command received.")
            # Use LLM to parse the task description
            parsed, _ = llm_call(
                f"Extract the task title and priority (1-5) from this request. "
                f"Return JSON: {{\"title\": \"...\", \"priority\": N}}\\nRequest: {instruction}",
                max_tokens=256
            )
            try:
                data = json.loads(parsed)
                new_id = max(b.get("id", 0) for b in self.backlog) + 1 if self.backlog else 1
                self.backlog.append({
                    "id": new_id,
                    "title": data.get("title", instruction),
                    "priority": data.get("priority", 3),
                    "status": "open",
                    "source": "steering",
                })
                save_backlog(self.backlog)
                log(f"  Added task #{new_id}: {data.get('title', instruction)[:60]}")
            except (json.JSONDecodeError, TypeError):
                log("  Could not parse task from instruction.")
        else:
            # Treat as a free-text note
            log(f"  Steering note: {instruction[:80]}")
            append_to_file(MEMORY_FILE, f"\n## Steering instruction ({now_sgt().strftime('%Y-%m-%d %H:%M')}):\n{instruction}\n")


# ── Entry point ────────────────────────────────────────────────────────────────

_agent_instance = None

def _signal_handler(signum, frame):
    """Handle SIGTERM/SIGINT by cleaning up lock and exiting."""
    global _agent_instance
    if _agent_instance and _agent_instance.lock_fd:
        release_lock(_agent_instance.lock_fd)
        _agent_instance.lock_fd = None
        try:
            os.unlink(LOCK_FILE)
        except OSError:
            pass
    log(f"Received signal {signum}. Cleaning up and exiting.")
    sys.exit(0)

if __name__ == "__main__":
    parse_args()
    signal.signal(signal.SIGTERM, _signal_handler)
    signal.signal(signal.SIGINT, _signal_handler)
    _agent_instance = AuElectronicCronAgent()
    _agent_instance.run()
