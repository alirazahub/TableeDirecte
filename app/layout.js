import './style.css'
import './guest.css'
import './staff.css'
import './print.css'
export const metadata = {
  title: 'Tablée Directe | QR Table Ordering',
  description: 'Browse the menu and order from your table.',
}
export default function Layout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
