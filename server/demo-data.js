import { menu } from '../lib/menu.js'
import { lineTotal, parisDay } from '../lib/operations.js'
import { demoCustomer } from '../lib/roles.js'
import { hashPassword } from './auth.js'

const minute = 60000
const ticket = (id, status, createdAt, updatedAt, note, quantities) => ({
  id, status, createdAt, updatedAt, note,
  items:Object.entries(quantities).map(([id,quantity]) => {
    const {name,price} = menu.find(dish => dish.id === id)
    return {id,name,price,quantity}
  }),
})
const visit = (id, fields) => ({
  _id:id, version:1, orders:[], calls:[], payments:[], reviews:[], history:[], ...fields,
})
const payment = (id, amount, tip, method, createdAt) => ({id,amount,tip,method,createdAt,email:''})
const seating = (party, seatedAt) => ({party,guestName:'',seatedAt})

export function demoRecords(now = Date.now()) {
  const at = minutes => now - minutes * minute
  const closedAt = at(22)
  const historical = {id:'demo-closed-6',closedAt,orders:2,cancelled:0,sales:5100,collected:5100,tips:450,rating:5,
    paymentDays:{[parisDay(closedAt)]:{collected:5100,tips:450}}}
  const records = [
    visit('1',{seating:seating(2,at(8))}),
    visit('2',{seating:seating(3,at(21)),orders:[ticket('demo-table-2','Cooking',at(17),at(14),'Sauce on the side.',{burger:2,fries:1})]}),
    visit('3',{seating:seating(2,at(21)),orders:[ticket('demo-table-3','Ready',at(16),at(2),'One extra plate, please.',{pizza:1,salad:1})]}),
    visit('4',{seating:seating(2,at(48)),orders:[ticket('demo-table-4','Served',at(43),at(28),'',{burger:2,coffee:2})],
      payments:[payment('demo-payment-4',2200,200,'card',at(6))],calls:[{id:'demo-bill-4',reason:'bill',createdAt:at(3),resolved:false}]}),
    visit('5',{seating:seating(2,at(55)),orders:[ticket('demo-table-5','Served',at(45),at(27),'',{pizza:1,cake:1})],
      payments:[payment('demo-payment-5',2650,250,'cash',at(7))],reviews:[{id:'demo-review-5',rating:5,comment:'Quick service and lovely food.',createdAt:at(6)}]}),
    visit('6',{history:[historical]}),
    visit('7',{seating:seating(4,at(6)),orders:[ticket('demo-table-7','Placed',at(3),at(3),'Please bring the dishes together.',{salad:1,pizza:1,coffee:2})],
      calls:[{id:'demo-water-7',reason:'water',createdAt:at(2),resolved:false},{id:'demo-cutlery-7',reason:'cutlery',createdAt:at(1),resolved:false}]}),
    visit('menu-settings',{unavailable:['cake']}),
    visit('customer-' + demoCustomer.username,{passwordHash:hashPassword(demoCustomer.password)}),
  ]

  const stages = ['Placed','Cooking','Ready','Out for delivery','Delivered']
  for (const [index,status] of stages.entries()) {
    const id = 'de000000-0000-4000-8000-' + String(index+1).padStart(12,'0')
    const sequence = stages.slice(0,index+1)
    const createdAt = at(4+index*10)
    const {items,note} = ticket(id,status,createdAt,createdAt,'Ring the demo bell at the entrance.',{pizza:1,fries:1})
    records.push(visit('delivery-' + id,{
      id,customer:demoCustomer.username,items,note,total:lineTotal(items),status,createdAt,
      recipient:'Demo delivery ' + (index+1),address:(10+index) + ' rue de la Démo, 75001 Paris',phone:'0100000000',
      driver:index >= 2 ? 'delivery' : undefined,
      events:sequence.map((stage,offset) => ({status:stage,at:createdAt+offset*3*minute})),
      location:status === 'Out for delivery' ? {latitude:48.86,longitude:2.34,at:at(2)} : undefined,
    }))
  }

  return records
}
