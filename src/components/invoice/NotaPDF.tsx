import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { formatRupiah } from '@/lib/utils'
import type { InvoiceData } from '@/lib/invoice-data'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 10, fontFamily: 'Courier', width: 226 },  // ~80mm
  center: { textAlign: 'center' },
  bold: { fontFamily: 'Courier-Bold' },
  divider: { borderBottom: '1px dashed #666', marginVertical: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
    fontFamily: 'Courier-Bold',
  },
})

interface NotaPDFProps {
  data: InvoiceData
}

export function NotaPDF({ data }: NotaPDFProps) {
  const tanggal = format(new Date(data.tanggal), 'dd/MM/yyyy', { locale: idLocale })

  return (
    <Document>
      <Page size={[226, 800]} style={styles.page}>
        <Text style={{ ...styles.center, ...styles.bold, fontSize: 12, marginBottom: 2 }}>
          AU Electronic
        </Text>
        <Text style={{ ...styles.center, fontSize: 8, marginBottom: 4 }}>
          Toko Spare Part Elektronik
        </Text>
        <View style={styles.divider} />

        <View style={styles.row}>
          <Text>Nota #</Text>
          <Text style={styles.bold}>{data.kodePesanan}</Text>
        </View>
        <View style={styles.row}>
          <Text>Tgl</Text>
          <Text>{tanggal}</Text>
        </View>
        <View style={styles.row}>
          <Text>Pelanggan</Text>
          <Text>{data.namaPelanggan}</Text>
        </View>

        <View style={styles.divider} />

        {data.items.map((item, i) => (
          <View key={i} style={{ marginBottom: 3 }}>
            <Text style={styles.bold}>{item.namaProduk}</Text>
            <View style={styles.row}>
              <Text>  {item.qty}x {formatRupiah(item.hargaSatuan)}</Text>
              <Text>{formatRupiah(item.subtotal)}</Text>
            </View>
          </View>
        ))}

        <View style={styles.divider} />

        <View style={styles.totalRow}>
          <Text>Total</Text>
          <Text>{formatRupiah(data.totalPesanan)}</Text>
        </View>
        {data.totalDibayar > 0 && (
          <View style={styles.row}>
            <Text>Dibayar</Text>
            <Text>{formatRupiah(data.totalDibayar)}</Text>
          </View>
        )}
        <View style={styles.totalRow}>
          <Text>{data.sisaTagihan <= 0 ? 'Status' : 'Sisa'}</Text>
          <Text>{data.sisaTagihan <= 0 ? 'LUNAS' : formatRupiah(data.sisaTagihan)}</Text>
        </View>

        {data.catatan && (
          <>
            <View style={styles.divider} />
            <Text style={{ fontSize: 8 }}>Catatan: {data.catatan}</Text>
          </>
        )}

        <View style={styles.divider} />
        <Text style={{ ...styles.center, fontSize: 8, marginTop: 4 }}>Terima kasih!</Text>
      </Page>
    </Document>
  )
}
