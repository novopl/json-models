const { TypedModel } = require('..');


class Person extends TypedModel {
  static props = {
    'name': { type: 'string', default: 'John' },
    'surname': { type: 'string', default: 'Doe' },
    'fullName': { type: 'string', readOnly: true },
  };

  get fullName() {
    return `${this.name} ${this.surname}`;
  }
}


class Table extends TypedModel {
  static props = {
    'number': {type: 'number'},
    'people': {type: 'array', items: { type: Person }},
  };
}


class Pizza extends TypedModel {
  static props = {
    'name': {type: 'string'},
    'ingredients': {type: 'array', items: {type: 'string'}},
  };
}


class Order extends TypedModel {
  static description = "Example nested model.";
  static props = {
    'id': { type: 'number', default: 1 },
    'pizza': { type: Pizza },
    'table': { type: Table }
  };
}




const order = new Order ({
  id: 1,
  pizza: {
    name: 'Hawaiian',
    ingredients: ['cheese', 'ham', 'pineapple'],
  },
  table: {
    number: 11,
    'people': [
      {name: 'John', surname: 'Doe'},
      {name: 'Jack', surname: 'Doe'},
      {name: 'Jill', surname: 'Doe'},
    ]
  }
});


console.log(order instanceof Order);                      // true
console.log(order.pizza instanceof Pizza);                // true
console.log(order.table instanceof Table);                // true
console.log(order.table.people[0] instanceof Person);     // true



console.log(order.asJson(2));
/*
{
  "id": 1,
  "pizza": {
    "name": "Hawaiian",
    "ingredients": ["cheese", "ham", "pineapple"],
  },
  "table": {
    "number": 11,
    "people": [
      {"name": "John", "surname": "Doe", "fullName": "John Doe"},
      {"name": "Jack", "surname": "Doe", "fullName": "Jack Doe"},
      {"name": "Jill", "surname": "Doe", "fullName": "Jill Doe"},
    ]
  }
}
*/



const obj = order.asObject();

console.log(order instanceof Order);                      // false
console.log(order.pizza instanceof Pizza);                // false
console.log(order.table instanceof Table);                // false
console.log(order.table.people[0] instanceof Person);     // false



console.log(JSON.stringify(Order.getSchema(), null, 2));
/*
{
  "$schema": "http://json-schema.org/schema#",
  "$id": "Order",
  "type": "object",
  "properties": {
    "id": {
      "type": "number",
      "default": 1
    },
    "pizza": {
      "$schema": "http://json-schema.org/schema#",
      "$id": "Pizza",
      "type": "object",
      "properties": {
        "name": {
          "type": "string"
        },
        "ingredients": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "additionalProperties": false
    },
    "table": {
      "$schema": "http://json-schema.org/schema#",
      "$id": "Table",
      "type": "object",
      "properties": {
        "number": {
          "type": "number"
        },
        "people": {
          "type": "array",
          "items": {}
        }
      },
      "additionalProperties": false
    }
  },
  "additionalProperties": false
}
 */



class TestModel extends TypedModel{
  static props = {
    'name': {type: 'string'},
  };
  static schema = {
    additionalProperties: true,
    required: ['name'],
  };
}

console.log(JSON.stringify(TestModel.getSchema(), null, 2));
/*
{
  "$schema": "http://json-schema.org/schema#",
  "$id": "TestModel",
  "type": "object",
  "properties": {
    "name": {
      "type": "string"
    }
  },
  "additionalProperties": true,
  "required": [
    "name"
  ]
}
*/
