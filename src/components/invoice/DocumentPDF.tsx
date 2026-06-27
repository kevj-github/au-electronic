import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { formatRupiah } from '@/lib/utils'
import type { InvoiceData } from '@/lib/invoice-data'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a' },
  watermark: {
    position: 'absolute',
    top: 212,
    left: 158,
    width: 280,
    height: 417,
    opacity: 0.07,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  crownImage: { width: 46, height: 68 },
  logoAU: { fontFamily: 'Times-Bold', fontSize: 36, marginRight: 2 },
  logoElectronic: { fontFamily: 'Helvetica-Bold', fontSize: 15 },
  logoSpareParts: { fontFamily: 'Helvetica', fontSize: 11, color: '#444' },
  metaRight: { alignItems: 'flex-end' },
  divider: { borderBottom: '1px solid #e5e7eb', marginVertical: 16 },
  kepadaBlock: { marginBottom: 16 },
  kepadaLabel: { color: '#6b7280', marginBottom: 2 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    padding: '6 8',
    borderBottom: '1px solid #e5e7eb',
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    padding: '6 8',
    borderBottom: '1px solid #f3f4f6',
  },
  colNo: { flex: 0.5 },
  colNama: { flex: 3.5 },
  colQty: { flex: 1, textAlign: 'right' },
  colHarga: { flex: 2, textAlign: 'right' },
  colSubtotal: { flex: 2, textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 12,
  },
  totalLabel: { width: 100, textAlign: 'right', color: '#6b7280', fontWeight: 'bold' },
  totalValue: { width: 100, textAlign: 'right', fontWeight: 'bold' },
  catatan: { marginTop: 16, color: '#6b7280' },
  returnNote: { marginTop: 16, fontSize: 9, color: '#6b7280', fontStyle: 'italic' },
  signatureRow: { flexDirection: 'row', marginTop: 40 },
  signatureBlock: { width: 160, textAlign: 'center' },
  signatureLine: { borderBottom: '1px solid #1a1a1a', marginTop: 40, marginBottom: 4 },
})

interface DocumentPDFProps {
  data: InvoiceData
  crownSrc?: string
  watermarkSrc?: string
}

export function DocumentPDF({ data, crownSrc, watermarkSrc }: DocumentPDFProps) {
  const tanggal = format(new Date(data.tanggal), 'd MMMM yyyy', { locale: idLocale })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {watermarkSrc && (
          <Image src={watermarkSrc} style={styles.watermark} />
        )}

        <View style={styles.headerRow}>
          <View style={styles.logoRow}>
            {crownSrc && <Image src={crownSrc} style={styles.crownImage} />}
            <Text style={styles.logoAU}>AU</Text>
            <View>
              <Text style={styles.logoElectronic}>Electronic</Text>
              <Text style={styles.logoSpareParts}>spare parts</Text>
            </View>
          </View>
          <View style={styles.metaRight}>
            <Text>Surabaya, {tanggal}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.kepadaBlock}>
          <Text style={styles.kepadaLabel}>Kepada Yth:</Text>
          <Text style={{ fontWeight: 'bold' }}>{data.namaPelanggan}</Text>
          {data.alamatPelanggan && <Text>{data.alamatPelanggan}</Text>}
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.colNo}>No</Text>
          <Text style={styles.colNama}>Nama Barang</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colHarga}>Harga Satuan</Text>
          <Text style={styles.colSubtotal}>Subtotal</Text>
        </View>
        {data.items.map((item, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.colNo}>{i + 1}</Text>
            <Text style={styles.colNama}>{item.namaBarang}</Text>
            <Text style={styles.colQty}>{item.qty}</Text>
            <Text style={styles.colHarga}>{formatRupiah(item.hargaSatuan)}</Text>
            <Text style={styles.colSubtotal}>{formatRupiah(item.subtotal)}</Text>
          </View>
        ))}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatRupiah(data.totalPesanan)}</Text>
        </View>

        {data.catatan && (
          <Text style={styles.catatan}>Catatan: {data.catatan}</Text>
        )}

        <Text style={styles.returnNote}>
          * Barang tidak dapat ditukarkan atau dikembalikan kecuali ada perjanjian sebelumnya.
        </Text>

        <View style={styles.signatureRow}>
          <View style={styles.signatureBlock}>
            <Text>Penerima,</Text>
            <View style={styles.signatureLine} />
          </View>
        </View>
      </Page>
    </Document>
  )
}
