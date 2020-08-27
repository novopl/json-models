# **json-models** - Simple JSONSchema based model system.


The purpose of this library is to help create an internal typed data structure
that can be used by the backend independently of the HTTP or database layers.

This is based on the hexagonal architecture. The DB and HTTP layers are just
adapters for data sources and sinks and the whole internal logic is implemented
in it's own types. **json-model** based classes are meant to be converted
to/from database models and HTTP requests/responses. Having the schema attached
means we can do proper validation during the conversions thus giving additional
protection to the actual data sinks/sources.

**json-models** allows to create classes with methods built around an object
that is defined by a JSONSchema. It supports both inheriting and nesting
schemas. If you subclass an existing model, you will inherit all it's
properties (and those of it's base classes). You can also nest models to achieve
tree like structures. Arrays are of course also supported.


## Example

Take a look at `tests/index.js` - all tests are written as small examples of
what the library can do.

```javascript
const { JsonModel } = require('json-models')


class Person extends JsonModel {
  static props = {
    'name': { type: 'string', default: 'John' },
    'surname': { type: 'string', default: 'Doe' },
    'fullName': { type: 'string', readOnly: true },
  };

  get fullName() {
    return `${this.name} ${this.surname}`;
  }
}


class Table extends JsonModel {
  static props = {
    'number': {type: 'number'},
    'people': {type: 'array', items: { type: Person }},
  };
}


class Pizza extends JsonModel {
  static props = {
    'name': {type: 'string'},
    'ingredients': {type: 'array', items: {type: 'string'}},
  };
}


class Order extends JsonModel {
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

console.log(order.as(2))
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
      {"name": "John", "surname": "Doe"},
      {"name": "Jack", "surname": "Doe"},
      {"name": "Jill", "surname": "Doe"},
    ] 
  }
}
*/

// Convert to a plain Javascript object (no classes inside).
const obj = order.asObject();

const values = {
  // A dictionary of values, we used one to build the order earlier in this example.
  // ...
};

const errors = Order.validate(values);

if (errors) {
  console.log("Validation failed: ", errors);
}
```