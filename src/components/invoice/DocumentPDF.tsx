import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer'
import { formatNumberID } from '@/lib/utils'
import type { InvoiceData } from '@/lib/invoice-data'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

// Wrap long words (item names, column headers) at word boundaries instead of
// hyphenating mid-word (e.g. avoid "SATU-AN").
Font.registerHyphenationCallback((word) => [word])

const ITEMS_PER_PAGE = 12

// Paper: 9.5 × 5.5 inches landscape → 684 × 396 pt (72 pt/inch)
const PAGE_SIZE = { width: 684, height: 396 }
const styles = StyleSheet.create({
  page: {
    paddingTop: 15,
    paddingHorizontal: 32,
    paddingBottom: 8,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  watermark: {
    position: 'absolute',
    top: 61,
    left: 242,
    width: 200,
    height: 297,
    opacity: 0.07,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  crownImage: { width: 38, height: 56 },
  logoTextBlock: { flexDirection: 'column' },
  logoNameRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  logoAU: { fontFamily: 'Times-Bold', fontSize: 27, lineHeight: 1 },
  logoElectronicBlock: { flexDirection: 'column', paddingBottom: 1 },
  logoElectronic: { fontFamily: 'Helvetica-Bold', fontSize: 12, lineHeight: 1 },
  logoSpareParts: { fontFamily: 'Helvetica', fontSize: 8, color: '#444', lineHeight: 1 },
  logoAddress: { fontFamily: 'Helvetica', fontSize: 8, color: '#555', marginTop: 2 },
  metaRight: { alignItems: 'flex-end', maxWidth: 160 },
  metaDate: { marginBottom: 6, fontSize: 10 },
  kepadaLabel: { color: '#6b7280', marginBottom: 1, fontSize: 9 },
  kepadaName: { fontFamily: 'Helvetica-Bold', fontSize: 11 },
  kepadaAlamat: { fontSize: 9, color: '#444', fontFamily: 'Helvetica-Bold' },
  divider: { borderBottom: '1px solid #1a1a1a', marginTop: 6, marginBottom: 0 },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 2,
    paddingHorizontal: 3,
    backgroundColor: '#f3f4f6',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    borderBottom: '1px solid #d1d5db',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 1.2,
    paddingHorizontal: 3,
    fontSize: 10.5,
    borderBottom: '1px solid #f3f4f6',
  },
  colNo: { width: 24, paddingRight: 3 },
  colQty: { width: 44, textAlign: 'right', paddingRight: 6 },
  colNama: { flex: 1, paddingRight: 6 },
  colHarga: { width: 100, textAlign: 'right', paddingRight: 6 },
  colSubtotal: { width: 92, textAlign: 'right' },
  colCheck: { width: 70, textAlign: 'center', paddingLeft: 6 },
  pageSubtotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 3,
    paddingTop: 3,
    borderTop: '1px solid #d1d5db',
  },
  pageSubtotalLabel: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: '#374151', marginRight: 8 },
  pageSubtotalValue: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: '#374151', width: 92, textAlign: 'right' },
  // Last-page footer: [perhatian] | [signature] | [total]
  bottomSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    gap: 16,
  },
  perhatianBox: {
    width: 210,
    border: '1px solid #d1d5db',
    padding: 5,
    backgroundColor: '#fef9c3',
  },
  perhatianTitle: { fontFamily: 'Helvetica-Bold', fontSize: 9, marginBottom: 2 },
  perhatianText: { fontSize: 8.5, color: '#374151', lineHeight: 1.3 },
  signatureBlock: { flex: 1, alignItems: 'center' },
  signatureLine: { borderBottom: '1px solid #1a1a1a', marginTop: 32, marginBottom: 3, width: '80%' },
  totalArea: { alignItems: 'flex-end', minWidth: 110 },
  totalLabel: { fontFamily: 'Helvetica-Bold', fontSize: 14, color: '#111' },
  totalValue: { fontFamily: 'Helvetica-Bold', fontSize: 14, color: '#111', marginTop: 2 },
})

interface DocumentPDFProps {
  data: InvoiceData
  crownSrc?: string
  watermarkSrc?: string
}

function PageHeader({
  tanggal,
  tanggalPengiriman,
  namaPelanggan,
  alamatPelanggan,
  crownSrc,
}: {
  tanggal: string
  tanggalPengiriman?: string
  namaPelanggan: string
  alamatPelanggan?: string
  crownSrc?: string
}) {
  return (
    <>
      <View style={styles.headerRow}>
        <View style={styles.logoRow}>
          {crownSrc && <Image src={crownSrc} style={styles.crownImage} />}
          <View style={styles.logoTextBlock}>
            <View style={styles.logoNameRow}>
              <Text style={styles.logoAU}>AU</Text>
              <View style={styles.logoElectronicBlock}>
                <Text style={styles.logoElectronic}>Electronic</Text>
                <Text style={styles.logoSpareParts}>spare parts</Text>
              </View>
            </View>
            <Text style={styles.logoAddress}>Genteng Electronic Center</Text>
            <Text style={styles.logoAddress}>Jl. Genteng Besar 43 Lt. 1 No. 109-111 Surabaya</Text>
            <Text style={styles.logoAddress}>No. HP/No. WA: 081 2351 7994</Text>
          </View>
        </View>

        <View style={styles.metaRight}>
          <Text style={styles.metaDate}>Tgl. Pesanan: {tanggal}</Text>
          <Text style={styles.metaDate}>
            Tgl. Pengiriman: {tanggalPengiriman ?? 'Belum ditentukan'}
          </Text>
          <Text style={styles.kepadaLabel}>Kepada Yth:</Text>
          <Text style={styles.kepadaName}>{namaPelanggan}</Text>
          {alamatPelanggan && (
            <Text style={styles.kepadaAlamat}>{alamatPelanggan}</Text>
          )}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.tableHeader}>
        <Text style={styles.colNo}>NO</Text>
        <Text style={styles.colQty}>QTY</Text>
        <Text style={styles.colNama}>NAMA BARANG</Text>
        <Text style={styles.colHarga}>HARGA SATUAN (Rp)</Text>
        <Text style={styles.colSubtotal}>JUMLAH (Rp)</Text>
        <Text style={styles.colCheck}>CHECK BARANG</Text>
      </View>
    </>
  )
}

export function DocumentPDF({ data, crownSrc, watermarkSrc }: DocumentPDFProps) {
  const tanggal = format(new Date(data.tanggal), 'd MMM yyyy', { locale: idLocale })
  const tanggalPengiriman = data.tanggalPengiriman
    ? format(new Date(data.tanggalPengiriman), 'd MMM yyyy', { locale: idLocale })
    : undefined

  const chunks: typeof data.items[] = []
  for (let i = 0; i < data.items.length; i += ITEMS_PER_PAGE) {
    chunks.push(data.items.slice(i, i + ITEMS_PER_PAGE))
  }
  if (chunks.length === 0) chunks.push([])

  const documentTitle = [data.namaPelanggan, data.alamatPelanggan, tanggal]
    .filter(Boolean)
    .join(' - ')

  return (
    <Document title={documentTitle}>
      {chunks.map((pageItems, pageIndex) => {
        const isLastPage = pageIndex === chunks.length - 1
        const startIndex = pageIndex * ITEMS_PER_PAGE
        const pageSubtotal = pageItems.reduce((sum, item) => sum + item.subtotal, 0)

        return (
          <Page key={pageIndex} size={PAGE_SIZE} style={styles.page}>
            {watermarkSrc && <Image src={watermarkSrc} style={styles.watermark} />}

            <PageHeader
              tanggal={tanggal}
              tanggalPengiriman={tanggalPengiriman}
              namaPelanggan={data.namaPelanggan}
              alamatPelanggan={data.alamatPelanggan}
              crownSrc={crownSrc}
            />

            {pageItems.map((item, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.colNo}>{startIndex + i + 1}</Text>
                <Text style={styles.colQty}>{item.qty}</Text>
                <Text style={styles.colNama}>{item.namaBarang.toUpperCase()}</Text>
                <Text style={styles.colHarga}>{formatNumberID(item.hargaSatuan)}</Text>
                <Text style={styles.colSubtotal}>{formatNumberID(item.subtotal)}</Text>
                <Text style={styles.colCheck} />
              </View>
            ))}

            {/* Per-page subtotal */}
            <View style={styles.pageSubtotalRow}>
              <Text style={styles.pageSubtotalLabel}>SUBTOTAL</Text>
              <Text style={styles.pageSubtotalValue}>{formatNumberID(pageSubtotal)}</Text>
              <View style={styles.colCheck} />
            </View>

            {/* [perhatian] + [signature] on every page; [total] on the last page only */}
            <View style={styles.bottomSection} wrap={false}>
              <View style={styles.perhatianBox}>
                <Text style={styles.perhatianTitle}>Perhatian:</Text>
                <Text style={styles.perhatianText}>
                  Barang yang sudah dibeli, tidak bisa ditukar / dikembalikan, kecuali sesuai perjanjian.
                </Text>
              </View>
              <View style={styles.signatureBlock}>
                <View style={styles.signatureLine} />
                <Text>Penerima,</Text>
              </View>
              {isLastPage && (
                <View style={styles.totalArea}>
                  <Text style={styles.totalLabel}>TOTAL</Text>
                  <Text style={styles.totalValue}>{formatNumberID(data.totalPesanan)}</Text>
                </View>
              )}
            </View>
          </Page>
        )
      })}
    </Document>
  )
}
