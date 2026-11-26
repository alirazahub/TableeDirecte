export const roles = {
  manager:{label:'Manager', views:['floor','reception','kitchen','catalog','dispatch','reports']},
  reception:{label:'Reception', views:['reception','floor','dispatch']},
  floor:{label:'Floor staff', views:['floor']},
  kitchen:{label:'Kitchen', views:['kitchen','catalog','dispatch']},
  delivery:{label:'Delivery driver', views:['dispatch']},
}

export const demoAccounts = [
  ['manager','2468'], ['reception','3579'], ['floor','4680'], ['kitchen','5791'], ['delivery','6802'],
]

export const demoCustomer = {username:'demo-guest',password:'Tablee-Demo-2026!'}
