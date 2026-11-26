import Restaurant from './restaurant'
export default async function Page({searchParams}) {
  const query = await searchParams
  const table = /^([1-9]|1[0-2])$/.test(query.table) ? query.table : '7'
  return <Restaurant table={table} tableKey={typeof query.key === 'string' ? query.key : ''}/>
}
