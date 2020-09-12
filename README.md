[![novopl](https://circleci.com/gh/novopl/typed-models.svg?style=shield)](https://app.circleci.com/pipelines/github/novopl/typed-models)
[![codecov](https://codecov.io/gh/novopl/typed-models/branch/master/graph/badge.svg)](https://codecov.io/gh/novopl/typed-models)

# **typed-models** - Simple JSONSchema based model system.


## About

The purpose of this library is to help create an internal typed data structure
that can be used by the backend independently of the HTTP or database layers.

This is based on the hexagonal architecture. The DB and HTTP layers are just
adapters for data sources and sinks and the whole internal logic is implemented
in it's own types. **json-model** based classes are meant to be converted
to/from database models and HTTP requests/responses. Having the schema attached
means we can do proper validation during the conversions thus giving additional
protection to the actual data sinks/sources.

**typed-models** allows to create classes with methods built around an object
that is defined by a JSONSchema. It supports both inheriting and nesting
schemas. If you subclass an existing model, you will inherit all it's
properties (and those of it's base classes). You can also nest models to achieve
tree like structures. Arrays are of course also supported.


### Useful Links

* [Source Code](https://github.com/novopl/typed-models)
* [CI Builds](https://app.circleci.com/pipelines/github/novopl/typed-models)


## Installation

    npm i typed-models
    yarn add typed-models

### Development

Before running the tests you must build the lib using `yarn build`. The tests
will import from `dist/`.

TODO: Need to setup babel with jest so we can import from `src/`.


## Example

*You can find this example in [./examples/example.js](examples/example.js).
You can also take a look at [./tests/index.spec.js](tests/index.spec.js) - all
tests are written as small examples of what the library can do.*

Let's suppose we want to model an order for a pizza restaurant. Here's how you
would define one using **typed-models**:

```javascript
const { TypedModel } = require('typed-models')


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
```

Now that we have the model, we can create an order. We will use a full
definition here:

```javascript
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
```

The result will be an instance of our `Order` class as well as all nested models
being instance of their corresponding model classes.

```javascript
console.log(order instanceof Order);                      // true
console.log(order.pizza instanceof Pizza);                // true  
console.log(order.table instanceof Table);                // true  
console.log(order.table.people[0] instanceof Person);     // true      
```

You can easily convert the order to a JSON string. The one optional argument is
the indentation for the resulting JSON. Leave it empty for a smallest output
string or set it to a chosen value if you need a readable version to log or show
somewhere.

```javascript
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
```

There's also an easy way to convert the model instance into a plain JSON object
(all model classes will be converted to plain objects).

```javascript
const obj = order.asObject();

console.log(order instanceof Order);                      // false
console.log(order.pizza instanceof Pizza);                // false  
console.log(order.table instanceof Table);                // false  
console.log(order.table.people[0] instanceof Person);     // false      
```

Of course you can always get the JSONSchema for any given model:

```javascript
console.log(JSON.stringify(Order.getSchema(), null, 2));
/* RESULT:
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
```

If you want to add or overwrite any of the generated properties within the
returned schema, you can use the static `schema` property for that:

```javascript
class TestModel extends TypedModel {
  static props = {
    'name': {type: 'string'},
  };
  static schema = {
    additionalProperties: true,
    required: ['name'],
  };
}

console.log(JSON.stringify(TestModel.getSchema(), null, 2));
/* RESULT:
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
```

Schema recursion is also supported (with the help of **$ref**). A `{$ref: '#'}`
will always refer to the current model schema.

```javascript
class Role extends TypedModel {
  static props = {
    'name': {type: 'string'},
    'roles': {type: 'array', items: {$ref: '#'}},
  };
}


const role = new Role({
  name: 'Test',
  roles: [
    { name: 'Sub1' },
    { name: 'Sub2', roles: [
      { name: 'SubSub1' }
    ] }
  ],
});

console.log(role instanceof Role);                      // false
console.log(role.roles[0] instanceof Role);             // false  
console.log(role.roles[1].roles[0] instanceof Role);    // false  
```


But there are also a few helpers for validation to make it easier:

```javascript
const values = {
  // A dictionary of values, we used one to build the order earlier in this example.
  // ...
};

const errors = Order.validate(values);

if (errors) {
  console.log("Validation failed: ", errors);
}
```