const photo = (id) => 'https://images.unsplash.com/photo-' + id + '?auto=format&fit=crop&w=650&q=83'
export const categories = ['All dishes', 'Mains', 'Sides', 'Drinks', 'Desserts']
export const menu = [
  {id:'burger', allergens:'Gluten, milk, eggs', diet:'', name:'The House Burger', category:'Mains', description:'Double smashed patties, aged cheddar, pickles and our house sauce.', price:1650, image:photo('1568901346375-23c9450c58cd'), label:'House favorite'},
  {id:'pizza', allergens:'Gluten, milk', diet:'Vegetarian', name:'Burrata & Basil Pizza', category:'Mains', description:'Wood-fired sourdough, San Marzano tomatoes, creamy burrata and fresh basil.', price:1800, image:photo('1579751626657-72bc17010498')},
  {id:'salad', allergens:'Mustard', diet:'Vegan', name:'Garden Harvest Bowl', category:'Mains', description:'Avocado, crisp greens, seasonal vegetables and a lemon vinaigrette.', price:1400, image:photo('1512621776951-a57141f2eefd'), label:'Plant based'},
  {id:'fries', allergens:'Milk', diet:'Vegetarian', name:'Parmesan Truffle Fries', category:'Sides', description:'Golden shoestring fries, shaved parmesan and a touch of truffle.', price:750, image:photo('1573080496219-bb080dd4f877')},
  {id:'coffee', allergens:'Oats', diet:'Vegan', name:'Iced Oat Latte', category:'Drinks', description:'House espresso poured over ice with creamy oat milk.', price:550, image:photo('1461023058943-07fcbe16d735')},
  {id:'cake', allergens:'Gluten, milk, eggs', diet:'Vegetarian', name:'Chocolate Layer Cake', category:'Desserts', description:'Rich chocolate sponge layered with silky dark chocolate frosting.', price:850, image:photo('1578985545062-69928b1d9587')},
]
