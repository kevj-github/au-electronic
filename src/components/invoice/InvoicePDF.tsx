import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'
import { formatRupiah } from '@/lib/utils'
import type { InvoiceData } from '@/lib/invoice-data'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a' },
  header: { marginBottom: 24 },
  shopName: { fontSize: 18, fontWeight: 'bold', marginBottom: 2 },
  shopSub: { fontSize: 9, color: '#666' },
  divider: { borderBottom: '1px solid #e5e7eb', marginVertical: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { color: '#6b7280', width: 80 },
  value: { flex: 1 },
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
  colNama: { flex: 3 },
  colQty: { flex: 1, textAlign: 'right' },
  colHarga: { flex: 2, textAlign: 'right' },
  colSubtotal: { flex: 2, textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 12,
  },
  totalLabel: { width: 100, textAlign: 'right', color: '#6b7280' },
  totalValue: { width: 100, textAlign: 'right', fontWeight: 'bold' },
  sisaValue: { width: 100, textAlign: 'right', fontWeight: 'bold', color: '#dc2626' },
  lunas: { width: 100, textAlign: 'right', fontWeight: 'bold', color: '#16a34a' },
  catatan: { marginTop: 16, color: '#6b7280' },
})

interface InvoicePDFProps {
  data: InvoiceData
}

export function InvoicePDF({ data }: InvoicePDFProps) {
  const tanggal = format(new Date(data.tanggal), 'd MMMM yyyy', { locale: idLocale })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.shopName}>AU Electronic</Text>
          <Text style={styles.shopSub}>Toko Spare Part Elektronik</Text>
        </View>

        <View style={styles.divider} />

        {/* Invoice meta */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 8 }}>INVOICE</Text>
          <View style={styles.row}>
            <Text style={styles.label}>No</Text>
            <Text style={styles.value}>: {data.kodePesanan}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tanggal</Text>
            <Text style={styles.value}>: {tanggal}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Kepada</Text>
            <Text style={styles.value}>: {data.namaPelanggan}</Text>
          </View>
          {data.alamatPelanggan && (
            <View style={styles.row}>
              <Text style={styles.label}></Text>
              <Text style={styles.value}>  {data.alamatPelanggan}</Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* Table */}
        <View style={styles.tableHeader}>
          <Text style={styles.colNama}>Produk</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colHarga}>Harga Satuan</Text>
          <Text style={styles.colSubtotal}>Subtotal</Text>
        </View>
        {data.items.map((item, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.colNama}>{item.namaProduk}</Text>
            <Text style={styles.colQty}>{item.qty} {item.satuan}</Text>
            <Text style={styles.colHarga}>{formatRupiah(item.hargaSatuan)}</Text>
            <Text style={styles.colSubtotal}>{formatRupiah(item.subtotal)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={{ marginTop: 8 }}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatRupiah(data.totalPesanan)}</Text>
          </View>
          {data.totalDibayar > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Sudah Dibayar</Text>
              <Text style={styles.totalValue}>{formatRupiah(data.totalDibayar)}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              {data.sisaTagihan <= 0 ? 'Status' : 'Sisa Tagihan'}
            </Text>
            {data.sisaTagihan <= 0 ? (
              <Text style={styles.lunas}>LUNAS</Text>
            ) : (
              <Text style={styles.sisaValue}>{formatRupiah(data.sisaTagihan)}</Text>
            )}
          </View>
        </View>

        {data.catatan && (
          <Text style={styles.catatan}>Catatan: {data.catatan}</Text>
        )}
      </Page>
    </Document>
  )
}
