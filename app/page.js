import { isTableId } from '../lib/floor-layout'
import Restaurant from './restaurant'
export default async function Page({ searchParams }) {
  const query = await searchParams
  const table = isTableId(query.table) ? query.table : '7'
  return <Restaurant table={table} tableKey={typeof query.key === 'string' ? query.key : ''} />
}
