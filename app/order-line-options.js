export default function OrderLineOptions({ item }) {
  if (!item.options?.length && !item.note) return null
  return (
    <span className="order-line-options">
      {!!item.options?.length && <span>{item.options.map((choice) => choice.name).join(' · ')}</span>}
      {item.note && <span>Note: {item.note}</span>}
    </span>
  )
}
