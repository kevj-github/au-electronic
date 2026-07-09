import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { formatRupiah } from '@/lib/utils'
import type { InvoiceData } from '@/lib/invoice-data'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

const ITEMS_PER_PAGE = 10

// A5: 419.53 × 595.28 pt
const styles = StyleSheet.create({
  page: {
    paddingTop: 20,
    paddingHorizontal: 28,
    paddingBottom: 36,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  watermark: {
    position: 'absolute',
    top: 148,
    left: 110,
    width: 200,
    height: 298,
    opacity: 0.07,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  crownImage: { width: 34, height: 50 },
  logoTextBlock: { flexDirection: 'column' },
  logoNameRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  logoAU: { fontFamily: 'Times-Bold', fontSize: 24, lineHeight: 1 },
  logoElectronicBlock: { flexDirection: 'column', paddingBottom: 1 },
  logoElectronic: { fontFamily: 'Helvetica-Bold', fontSize: 11, lineHeight: 1 },
  logoSpareParts: { fontFamily: 'Helvetica', fontSize: 8, color: '#444', lineHeight: 1 },
  logoAddress: { fontFamily: 'Helvetica', fontSize: 7, color: '#555', marginTop: 2 },
  metaRight: { alignItems: 'flex-end', maxWidth: 160 },
  metaDate: { marginBottom: 6, fontSize: 9 },
  kepadaLabel: { color: '#6b7280', marginBottom: 1, fontSize: 8 },
  kepadaName: { fontFamily: 'Helvetica-Bold', fontSize: 10 },
  kepadaAlamat: { fontSize: 8, color: '#444' },
  divider: { borderBottom: '1px solid #1a1a1a', marginTop: 8, marginBottom: 0 },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 3,
    backgroundColor: '#f3f4f6',
    fontFamily: 'Helvetica-Bold',
    borderBottom: '1px solid #d1d5db',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 3,
    borderBottom: '1px solid #f3f4f6',
  },
  colNo: { width: 22, paddingRight: 3 },
  colQty: { width: 36, textAlign: 'right', paddingRight: 6 },
  colNama: { flex: 1, paddingRight: 6 },
  colHarga: { width: 72, textAlign: 'right', paddingRight: 6 },
  colSubtotal: { width: 72, textAlign: 'right' },
  pageSubtotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 4,
    borderTop: '1px solid #d1d5db',
    gap: 8,
  },
  pageSubtotalLabel: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#374151' },
  pageSubtotalValue: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#374151', width: 72, textAlign: 'right' },
  // Last-page footer: perhatian box (left) + right column with total + signature
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    marginTop: 10,
    gap: 12,
  },
  perhatianBox: {
    flex: 1,
    border: '1px solid #d1d5db',
    padding: 6,
    backgroundColor: '#fef9c3',
  },
  perhatianTitle: { fontFamily: 'Helvetica-Bold', fontSize: 8, marginBottom: 2 },
  perhatianText: { fontSize: 7.5, color: '#374151', lineHeight: 1.4 },
  // Right column: total on top, signature at bottom
  rightColumn: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minWidth: 110,
  },
  totalArea: { alignItems: 'flex-end' },
  totalLabel: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: '#111' },
  totalValue: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: '#111', marginTop: 2 },
  signatureBlock: { alignItems: 'center', width: 110 },
  signatureLine: { borderBottom: '1px solid #1a1a1a', marginTop: 24, marginBottom: 3, width: '100%' },
})

interface DocumentPDFProps {
  data: InvoiceData
  crownSrc?: string
  watermarkSrc?: string
}

function PageHeader({
  tanggal,
  namaPelanggan,
  alamatPelanggan,
  crownSrc,
}: {
  tanggal: string
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
          <Text style={styles.metaDate}>Surabaya, {tanggal}</Text>
          <Text style={styles.kepadaLabel}>Kepada Yth:</Text>
          <Text style={styles.kepadaName}>{namaPelanggan}</Text>
          {alamatPelanggan && (
            <Text style={styles.kepadaAlamat}>{alamatPelanggan}</Text>
          )}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.tableHeader}>
        <Text style={styles.colNo}>No</Text>
        <Text style={styles.colQty}>Qty</Text>
        <Text style={styles.colNama}>Nama Barang</Text>
        <Text style={styles.colHarga}>Harga Satuan</Text>
        <Text style={styles.colSubtotal}>Jumlah</Text>
      </View>
    </>
  )
}

export function DocumentPDF({ data, crownSrc, watermarkSrc }: DocumentPDFProps) {
  const tanggal = format(new Date(data.tanggal), 'd MMM yyyy', { locale: idLocale })

  const chunks: typeof data.items[] = []
  for (let i = 0; i < data.items.length; i += ITEMS_PER_PAGE) {
    chunks.push(data.items.slice(i, i + ITEMS_PER_PAGE))
  }
  if (chunks.length === 0) chunks.push([])

  return (
    <Document>
      {chunks.map((pageItems, pageIndex) => {
        const isLastPage = pageIndex === chunks.length - 1
        const startIndex = pageIndex * ITEMS_PER_PAGE
        const pageSubtotal = pageItems.reduce((sum, item) => sum + item.subtotal, 0)

        return (
          <Page key={pageIndex} size="A5" style={styles.page}>
            {watermarkSrc && <Image src={watermarkSrc} style={styles.watermark} />}

            <PageHeader
              tanggal={tanggal}
              namaPelanggan={data.namaPelanggan}
              alamatPelanggan={data.alamatPelanggan}
              crownSrc={crownSrc}
            />

            {pageItems.map((item, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.colNo}>{startIndex + i + 1}</Text>
                <Text style={styles.colQty}>{item.qty}</Text>
                <Text style={styles.colNama}>{item.namaBarang}</Text>
                <Text style={styles.colHarga}>{formatRupiah(item.hargaSatuan)}</Text>
                <Text style={styles.colSubtotal}>{formatRupiah(item.subtotal)}</Text>
              </View>
            ))}

            {/* Per-page subtotal */}
            <View style={styles.pageSubtotalRow}>
              <Text style={styles.pageSubtotalLabel}>Subtotal</Text>
              <Text style={styles.pageSubtotalValue}>{formatRupiah(pageSubtotal)}</Text>
            </View>

            {/* Last page: perhatian (left) + total & signature (right), all in one row */}
            {isLastPage && (
              <View style={styles.bottomSection} wrap={false}>
                <View style={styles.perhatianBox}>
                  <Text style={styles.perhatianTitle}>Perhatian:</Text>
                  <Text style={styles.perhatianText}>
                    Barang yang sudah dibeli, tidak bisa ditukar / dikembalikan, kecuali sesuai perjanjian.
                  </Text>
                </View>
                <View style={styles.rightColumn}>
                  <View style={styles.totalArea}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>{formatRupiah(data.totalPesanan)}</Text>
                  </View>
                  <View style={styles.signatureBlock}>
                    <Text>Penerima,</Text>
                    <View style={styles.signatureLine} />
                  </View>
                </View>
              </View>
            )}
          </Page>
        )
      })}
    </Document>
  )
}
