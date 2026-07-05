import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { formatRupiah } from '@/lib/utils'
import type { InvoiceData } from '@/lib/invoice-data'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

// Height reserved for the fixed header (paddingTop: 26 + logo row ~72 + divider ~14 + tableHeader ~24)
const HEADER_PAD = 152

const styles = StyleSheet.create({
  page: {
    paddingTop: HEADER_PAD,
    paddingHorizontal: 40,
    paddingBottom: 60,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  watermark: {
    position: 'absolute',
    top: 212,
    left: 158,
    width: 280,
    height: 417,
    opacity: 0.07,
  },
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 26,
    paddingHorizontal: 40,
    backgroundColor: 'white',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  // Crown image + text block sit side by side
  logoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  crownImage: { width: 42, height: 62 },
  logoTextBlock: { flexDirection: 'column' },
  // "AU" and "Electronic / spare parts" sit on the same row
  logoNameRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  logoAU: { fontFamily: 'Times-Bold', fontSize: 30, lineHeight: 1 },
  logoElectronicBlock: { flexDirection: 'column', paddingBottom: 1 },
  logoElectronic: { fontFamily: 'Helvetica-Bold', fontSize: 14, lineHeight: 1 },
  logoSpareParts: { fontFamily: 'Helvetica', fontSize: 9.5, color: '#444', lineHeight: 1 },
  logoAddress: { fontFamily: 'Helvetica', fontSize: 7.5, color: '#555', marginTop: 2 },
  // Right column: date + Kepada Yth
  metaRight: { alignItems: 'flex-end', maxWidth: 200 },
  metaDate: { marginBottom: 8 },
  kepadaLabel: { color: '#6b7280', marginBottom: 2 },
  kepadaName: { fontFamily: 'Helvetica-Bold', fontSize: 11 },
  kepadaAlamat: { fontSize: 9, color: '#444' },
  divider: { borderBottom: '1px solid #1a1a1a', marginTop: 10, marginBottom: 0 },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
    backgroundColor: '#f3f4f6',
    fontFamily: 'Helvetica-Bold',
    borderBottom: '1px solid #d1d5db',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottom: '1px solid #f3f4f6',
  },
  colNo: { width: 28, paddingRight: 4 },
  colQty: { width: 60, textAlign: 'right', paddingRight: 8 },
  colNama: { flex: 1, paddingRight: 8 },
  colHarga: { width: 80, textAlign: 'right', paddingRight: 8 },
  colSubtotal: { width: 80, textAlign: 'right' },
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 12,
    gap: 16,
  },
  perhatianBox: {
    flex: 1,
    border: '1px solid #d1d5db',
    padding: 8,
    backgroundColor: '#fef9c3',
  },
  perhatianTitle: { fontFamily: 'Helvetica-Bold', fontSize: 9, marginBottom: 3 },
  perhatianText: { fontSize: 8.5, color: '#374151', lineHeight: 1.4 },
  totalArea: { alignItems: 'flex-end', minWidth: 150 },
  totalLabel: { fontFamily: 'Helvetica-Bold', fontSize: 13, color: '#111' },
  totalValue: { fontFamily: 'Helvetica-Bold', fontSize: 13, color: '#111', marginTop: 2 },
  signatureRow: {
    flexDirection: 'row',
    marginTop: 40,
    paddingHorizontal: 20,
  },
  signatureBlock: { width: 150, alignItems: 'center' },
  signatureLine: { borderBottom: '1px solid #1a1a1a', marginTop: 40, marginBottom: 4, width: '100%' },
})

interface DocumentPDFProps {
  data: InvoiceData
  crownSrc?: string
  watermarkSrc?: string
}

export function DocumentPDF({ data, crownSrc, watermarkSrc }: DocumentPDFProps) {
  const tanggal = format(new Date(data.tanggal), 'd MMM yyyy', { locale: idLocale })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {watermarkSrc && (
          <Image src={watermarkSrc} style={styles.watermark} />
        )}

        {/* Fixed header — repeats on every page */}
        <View fixed style={styles.fixedHeader}>
          <View style={styles.headerRow}>
            {/* Left: crown + "AU Electronic / spare parts" + address */}
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

            {/* Right: date + Kepada Yth */}
            <View style={styles.metaRight}>
              <Text style={styles.metaDate}>Surabaya, {tanggal}</Text>
              <Text style={styles.kepadaLabel}>Kepada Yth:</Text>
              <Text style={styles.kepadaName}>{data.namaPelanggan}</Text>
              {data.alamatPelanggan && (
                <Text style={styles.kepadaAlamat}>{data.alamatPelanggan}</Text>
              )}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Table column headers */}
          <View style={styles.tableHeader}>
            <Text style={styles.colNo}>No</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colNama}>Nama Barang</Text>
            <Text style={styles.colHarga}>Harga Satuan</Text>
            <Text style={styles.colSubtotal}>Jumlah</Text>
          </View>
        </View>

        {/* Item rows */}
        {data.items.map((item, i) => (
          <View key={i} style={styles.tableRow} wrap={false}>
            <Text style={styles.colNo}>{i + 1}</Text>
            <Text style={styles.colQty}>{item.qty}</Text>
            <Text style={styles.colNama}>{item.namaBarang}</Text>
            <Text style={styles.colHarga}>{formatRupiah(item.hargaSatuan)}</Text>
            <Text style={styles.colSubtotal}>{formatRupiah(item.subtotal)}</Text>
          </View>
        ))}

        {/* Bottom: Perhatian (left) + Total (right) */}
        <View style={styles.bottomSection} wrap={false}>
          <View style={styles.perhatianBox}>
            <Text style={styles.perhatianTitle}>Perhatian:</Text>
            <Text style={styles.perhatianText}>
              Barang yang sudah dibeli, tidak bisa ditukar / dikembalikan, kecuali sesuai perjanjian.
            </Text>
          </View>
          <View style={styles.totalArea}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatRupiah(data.totalPesanan)}</Text>
          </View>
        </View>

        {/* Signature */}
        <View style={styles.signatureRow} wrap={false}>
          <View style={styles.signatureBlock}>
            <Text>Penerima,</Text>
            <View style={styles.signatureLine} />
          </View>
        </View>
      </Page>
    </Document>
  )
}
