const { expect } = require('chai');
const { TypedModel, isModel, isModelClass } = require('../src/TypedModel');


class User extends TypedModel {
  static props = {
    'name': { type: 'string', default: 'John' },
    'surname': { type: 'string', default: 'Doe' },
    'fullName': { type: 'string', readOnly: true },
  };

  get fullName() {
    return `${this.name} ${this.surname}`;
  }
}


class Order extends TypedModel {
  static props = {
    'id': { type: 'number', default: 1 },
    'user': { type: User },
  };
  static schema = {
    description: 'Example nested model.',
    additionalProperties: true,
  };
}


class Pizza extends TypedModel {
  static props = {
    'name': {type: 'string'},
    'ingredients': {type: 'array', items: {type: 'string'}},
  };
}


class Table extends TypedModel {
  static props = {
    'number': {type: 'number'},
    'people': {type: 'array', items: { type: User }},
  };
}


describe('TypedModel', () => {
  describe('constructor()', () => {
    it('Works with plain objects.', () => {
      const user = new User({
        name: 'Jack',
        surname: 'Crack'
      });

      expect(user).to.be.an.instanceof(User);
      expect(user.name).to.equal('Jack');
      expect(user.surname).to.equal('Crack');
      expect(user.fullName).to.equal('Jack Crack');
    });


    it ('Works with nested models.', () => {
      const order = new Order({
        id: 1,
        user: {
          name: 'Jack',
          surname: 'Crack',
        }
      });

      expect(order).to.be.an.instanceof(Order);
      expect(order.user).to.be.an.instanceof(User);
      expect(order.id).to.equal(1);
      expect(order.user.name).to.equal('Jack');
      expect(order.user.surname).to.equal('Crack');
      expect(order.user.fullName).to.equal('Jack Crack');
    });


    it('Initializes with defaults.', () => {
      const user = new User();
      const values = user.asObject();

      expect(values).to.eql({
        name: 'John',
        surname: 'Doe',
        fullName: 'John Doe',
      });
    });


    it('Ignores read-only fields.', () => {
      const user = new User({
        name: 'Jack',
        surname: 'Crack',
        fullName: 'READ_ONLY'
      });

      expect(user.fullName).to.equal('Jack Crack');
    });


    it("Won't try to construct sub model if it's value is undefined", () => {
      const order = new Order();

      expect(order.id).to.not.be.undefined;   // There's a default.
      expect(order.user).to.be.undefined;
    });


    it('Supports plain arrays', () => {
      const pizza = new Pizza({
        name: 'Hawaii',
        ingredients: ['cheese', 'ham', 'pineapple'],
      });

      expect(pizza.name).to.equal('Hawaii');
      expect(pizza.ingredients).to.eql(['cheese', 'ham', 'pineapple']);
    });


    it('Supports sub model arrays', () => {
      const table = new Table({
        number: 8,
        people: [
          {name: 'John', surname: 'Doe'},
          {name: 'Jack', surname: 'Doe'},
          {name: 'Jill', surname: 'Doe'},
        ],
      });

      expect(table.number).to.equal(8);
      expect(table.people[0]).to.be.an.instanceof(User);
      expect(table.people[1]).to.be.an.instanceof(User);
      expect(table.people[2]).to.be.an.instanceof(User);

      expect(table.people[0].fullName).to.equal('John Doe');
      expect(table.people[1].fullName).to.equal('Jack Doe');
      expect(table.people[2].fullName).to.equal('Jill Doe');
    });


    it('Supports nested object schemas', () => {
      class TestModel extends TypedModel {
        static props = {
          'nested': {
            type: 'object',
            properties: {
              'key': {type: 'string'},
              'value': {type: 'string'},
            }
          }
        };
      }
      const t = new TestModel({
        nested: {
          key: 'kk',
          value: 'vv',
        }
      });

      const data = t.asObject();
      expect(data).to.eql({
        nested: {
          key: 'kk',
          value: 'vv',
        }
      });
    });


    it('Supports Double nested schemas', () => {
      class TestModel extends TypedModel {
        static props = {
          'nested': {
            type: 'object',
            properties: {
              'user': { type: User },
            }
          }
        };
      }

      const t = new TestModel({
        nested: {
          user: {
            name: 'Jack',
            surname: 'Crack',
          }
        }
      });

      expect(t).to.be.an.instanceof(TestModel);
      expect(t.nested.user).to.be.an.instanceof(User);
    });


    it('Subclass inherits properties from the base class', () => {
      class Base extends TypedModel {
        static props = {
          'prop1': {type: 'string'},
        };
      }

      class Derived extends Base {
        static props = {
          'prop2': {type: 'string'},
        };
      }

      const instance = new Derived({ prop1: 'value1', prop2: 'value2' });

      expect(instance.prop1).to.equal('value1');
      expect(instance.prop2).to.equal('value2');
      expect(instance.asObject()).to.eql({
        prop1: 'value1',
        prop2: 'value2',
      })
    });


    it('Subclass can override base class field', () => {
      class Base extends TypedModel {
        static props = {
          'prop1': {type: 'string'},
          'prop2': {type: 'string'},
        };
      }

      class Derived extends Base {
        static props = {
          'prop2': {type: 'number'},
        };
      }

      const instance = new Derived({ prop1: 'value1', prop2: 4 });

      expect(instance.prop1).to.equal('value1');
      expect(instance.prop2).to.equal(4);
    });


    it('Inheritance works across multiple levels', () => {
      class A extends TypedModel { static props = { 'prop1': {type: 'string'} }; }
      class B extends A             { static props = { 'prop2': {type: 'string'} }; }
      class C extends B             { static props = { 'prop3': {type: 'string'} }; }

      const instance = new C({ prop1: 'value1', prop2: 'value2', prop3: 'value3' });

      expect(instance.prop1).to.equal('value1');
      expect(instance.prop2).to.equal('value2');
      expect(instance.prop3).to.equal('value3');
      expect(instance.asObject()).to.eql({
        prop1: 'value1',
        prop2: 'value2',
        prop3: 'value3',
      })
    });


    it('Works even if one of the classes does not specify props', () => {
      class A extends TypedModel { static props = { 'prop1': {type: 'string'} }; }
      class B extends A             { }
      class C extends B             { static props = { 'prop3': {type: 'string'} }; }

      const instance = new C({ prop1: 'value1', prop3: 'value3' });

      expect(instance.prop1).to.equal('value1');
      expect(instance.prop3).to.equal('value3');
    });


    it('Can remove inherited properties by setting their schema to undefined', () => {
      class InvalidBase extends TypedModel {
        static props = {
          'name': {type: 'string'},
          'key': {type: 'string'},
          'items': {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                'key': {type: 'string'},
                'value': {type: 'number'},
              }
            }
          },
        };
      }

      class Invalid extends InvalidBase {
        static props = {
          'key': undefined,
        }

      }

      try {
        const object = new Invalid({
          name: 'Invalid',
          items: [
            {key: 'item1', value: 1},
            {key: 'item2', value: 2},
            {key: 'item3', value: 3},
          ]
        });
      } catch (err) {
        console.error(err);
        throw err;
      }
    });


    it('Supports date and date-time formats out of the box', () => {
      class TestModel extends TypedModel {
        static props = {
          'createdAt': { type: 'string', format: 'date-time' },
          'validUntil': { type: 'string', format: 'date' },
        };
      }

      const instance = new TestModel({
        createdAt: new Date().toISOString(),
        validUntil: new Date(2020, 10, 10),
      });

      expect(instance.createdAt).to.be.an.instanceof(Date);
      expect(instance.validUntil).to.be.an.instanceof(Date);

      const obj = instance.asObject();
      expect(typeof obj.createdAt).to.equal('string');
      expect(obj.validUntil).to.equal('2020-11-10');
    });


    it('Supports custom string formats', () => {
      class CustomModel {
        constructor(str) {
          this.value = str;
        }

        toString() {
          return this.value;
        }
      }

      TypedModel.formats.register('custom', {
        load: str => new CustomModel(str),
        dump: value => value.toString(),
      });

      class TestModel extends TypedModel {
        static props = {
          'custom': {type: 'string', format: 'custom'},
        };
      }

      const instance = new TestModel({
        custom: 'asdf',
      });

      expect(instance.custom).to.be.an.instanceof(CustomModel);
    });


    it('Uses raw string if no converter registered for a custom format', () => {
      class TestModel extends TypedModel {
        static props = {
          'missingFormat': {type: 'string', format: 'missing'},
        };
      }

      const instance = new TestModel({
        missingFormat: 'asdf',
      });

      expect(typeof instance.missingFormat).to.equal('string');
      expect(instance.missingFormat).to.equal('asdf');
      expect(instance.asObject()).to.eql({ missingFormat: 'asdf' });
    });


    it('Supports functions as defaults', () => {
      class TestModel extends TypedModel {
        static props = {
          'theAnswer': { type: 'number', default: () => 42 },
        };
      }

      const instance = new TestModel();

      expect(instance.theAnswer).to.equal(42);
    });


    it('Keeps prop trace for errors when building model instance', () => {
      class TestModel extends TypedModel {
        static props = {
          'items': {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                'fixed': {type: 'number'},
                'dynamic': {type: 'number', default: () => { throw new Error("Failed") }},
              }
            }
          },
        };
      }

      try {
        new TestModel({
          'items': [
            {fixed: 12, dynamic: 32},
            {fixed: 13, dynamic: 32},
            {fixed: 14},
          ]
        });
      } catch(err) {
        expect(err.traceback).to.equal('$.items[2].dynamic');
      }
    });


    it('Does not convert undefined to dates and vice-versa', () => {
      class TestModel extends TypedModel {
        static props = {
          'createdAt': { type: 'string', format: 'date' },
          'updatedAt': { type: 'string', format: 'date' },
        };
      }

      const instance = new TestModel({
        createdAt: undefined,
        updatedAt: null,
      });

      expect(instance.createdAt).to.be.undefined;
      expect(instance.updatedAt).to.be.null;

      const data = instance.asObject();
      expect(data).to.eql({
        createdAt: undefined,
        updatedAt: null,
      })
    });


    it('Format converters properly handle null value', () => {
      class TestModel extends TypedModel {
        static props = {
          'imageUrl': {type: 'string'},
        };
      }

      const instance = new TestModel({ imageUrl: null });

      expect(instance.imageUrl).to.be.null;
      expect(instance.asObject().imageUrl).to.be.null;
    });


    it('Can implement an ANY type object by not defining properties', () => {
      class Any extends TypedModel {
        static schema = { additionalProperties: true };
      }

      const any = new Any({
        msg: "hello",
        value: 3.14159,
      });

      expect(any.msg).to.equal("hello");
      expect(any.value).to.equal(3.14159);
      expect(any.asObject()).to.eql({
        msg: "hello",
        value: 3.14159,
      });
    });

    it('ANY pattern works with nested types', () => {
      class Any extends TypedModel {
        static schema = { additionalProperties: true };
      }

      class AnyNested extends TypedModel {
        static props = {
          'data': {type: Any},
        };
      }

      const parent = new AnyNested({
        data: {
          msg: "hello",
          value: 3.14159,
        },
      });

      expect(parent.data).to.be.an.instanceof(Any);
      expect(parent.asObject()).to.eql({
        data: {
          msg: "hello",
          value: 3.14159,
        },
      })
    });
  });


  describe('getSchema()', () => {
    it('Works with flat models', () => {
      expect(User.getSchema()).to.eql({
        $schema: 'http://json-schema.org/schema#',
        $id: 'User',
        type: 'object',
        additionalProperties: false,
        properties: {
          'name': { type: 'string', default: 'John' },
          'surname': { type: 'string', default: 'Doe' },
          'fullName': { type: 'string', readOnly: true },
        },
      })
    });


    it('Works for nested models', () => {
      const schema = Order.getSchema();

      expect(schema).to.eql({
        $schema: 'http://json-schema.org/schema#',
        $id: 'Order',
        type: 'object',
        additionalProperties: true,
        description: 'Example nested model.',
        properties: {
          'id': { type: 'number', default: 1 },
          'user': {
            $schema: 'http://json-schema.org/schema#',
            $id: 'User',
            type: 'object',
            additionalProperties: false,
            properties: {
              'name': { type: 'string', default: 'John' },
              'surname': { type: 'string', default: 'Doe' },
              'fullName': { type: 'string', readOnly: true },
            },
          },
        },
      })
    });


    it('Can extend schema using static schema property', () => {
      const schema = Order.getSchema();

      expect(schema.description).to.equal('Example nested model.');
      expect(schema.additionalProperties).to.equal(true);
    });


    it('Will not include description if not given', () => {
      const schema = User.getSchema();

      expect(schema.hasOwnProperty('description')).to.not.be.true;
    });


    it('Can leave models in the schema.', () => {
      const schema = Order.getSchema({ leaveModels: true });

      expect(schema).to.eql({
        $schema: 'http://json-schema.org/schema#',
        $id: 'Order',
        type: 'object',
        additionalProperties: true,
        description: 'Example nested model.',
        properties: {
          'id': { type: 'number', default: 1 },
          'user': { type: User },
        },
      })
    });


    it('Passes down leaveModels configuration', () => {
      class DoubleNest extends TypedModel {
        static props = {
          order: {type: Order},
          nested: {
            type: 'object',
            properties: {
              user: {type: User},
            }
          }
        };
      }

      const schema = DoubleNest.getSchema({ leaveModels: true });

      expect(schema).to.eql({
        $schema: 'http://json-schema.org/schema#',
        $id: 'DoubleNest',
        type: 'object',
        additionalProperties: false,
        properties: {
          order: {type: Order},
          nested: {
            type: 'object',
            properties: {
              user: {type: User},
            }
          }
        },
      });
    });


    it('Supports schema recursion', () => {
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

      expect(role).to.be.an.instanceof(Role);

      expect(role.roles[0]).to.be.an.instanceof(Role);
      expect(role.roles[0].name).to.equal('Sub1');

      expect(role.roles[1]).to.be.an.instanceof(Role);
      expect(role.roles[1].name).to.equal('Sub2');

      expect(role.roles[1].roles[0]).to.be.an.instanceof(Role);
      expect(role.roles[1].roles[0].name).to.equal('SubSub1');
    });
  });


  describe('static asObject()', () => {
    it('Works', () => {
      const userData = {
        name: 'Jack',
        surname: 'Crack'
      };

      expect(User.asObject(userData)).to.eql({
        name: 'Jack',
        surname: 'Crack',
        fullName: 'Jack Crack',
      })
    });
  });


  describe('asObject()', () => {
    it('Includes getter properties.', () => {
      const user = new User({name: 'Jack', surname: 'Crack'});

      expect(user.asObject()).to.eql({
        name: 'Jack',
        surname: 'Crack',
        fullName: 'Jack Crack',
      });
    });


    it('Works with nested schemas', () => {
      const order = new Order({
        id: 1,
        user: {
          name: 'Jack',
          surname: 'Crack',
        }
      });

      const values = order.asObject();

      expect(values).to.eql({
        id: 1,
        user: {
          name: 'Jack',
          surname: 'Crack',
          fullName: 'Jack Crack',
        }
      })
    });


    it('Wont try to process undefined values', () => {
      const order = new Order();
      const values = order.asObject();

      expect(values.user).to.be.undefined;
    })


    it('Will coerce values to string if prop type is string', () => {
      class TestModel extends TypedModel {
        static props = {
          'theAnswer': {type: 'string'},
        };
      }

      const instance = new TestModel({ theAnswer: 24 });

      const obj = instance.asObject();
      expect(typeof obj.theAnswer).to.equal('string');
    });
  });


  describe('toJson()', () => {
    it('includes properties', () => {
      const user = new User({
        name: 'John',
      });

      const data = JSON.parse(user.asJson());

      expect(data).to.eql({
        name: 'John',
        surname: 'Doe',
        fullName: 'John Doe',
      });
    });


    it('Works with nested models', () => {
      const order = new Order({
        id: 5,
        user: new User().asObject(),
      });

      const data = JSON.parse(order.asJson());

      expect(data).to.eql({
        id: 5,
        user: {
          name: 'John',
          surname: 'Doe',
          fullName: 'John Doe',
        }
      });
    })
  });


  describe('validate()', () => {
    it('Returns nothing if validation was successful', () => {
      const err = User.validate({
        name: 'John',
        surname: 'Doe',
      });

      expect(err).to.be.undefined;
    });


    it('Returns error if validation failed', () => {
      const err = User.validate({
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(err).to.not.be.undefined;
    });
  });

  describe('setValues()', () => {
    it('Does not set property if not given in values', () => {
      const user = new User({ name: 'John', surname: 'Jones' });

      user.setValues({
        name: 'Jane',
      });

      expect(user.name).to.equal('Jane');
      expect(user.surname).to.equal('Jones');
      expect(user.fullName).to.equal('Jane Jones');
    });

    it('Ignores values that are not part of the model', () => {
      const user = new User({ name: 'John', surname: 'Jones' });

      user.setValues({
        name: 'Jane',
        age: 29,
      });

      expect(user.name).to.equal('Jane');
      expect(user.surname).to.equal('Jones');
      expect(user.fullName).to.equal('Jane Jones');
      expect(user).to.not.have.own.property('age');
    });

    it('Uses converters', () => {
      class TestModel extends TypedModel {
        static props = {
          'updatedAt': { type: 'string', format: 'date-time' },
        };
      }

      const createDate = new Date(2020, 5, 10);
      const updateDate = new Date(2020, 5, 11);
      const instance = new TestModel({ updatedAt: createDate.toISOString() });

      instance.setValues({ updatedAt: updateDate.toISOString() });

      expect(instance.updatedAt).to.eql(updateDate);
    });
  });
});


describe('isModel', () => {
  class FakeModel {
    static props = {
      'key': {type: 'string'},
      'value': {type: 'string'}
    };
  }


  it('Returns true if the object is an instance of BusinessModel', () => {
    const user = new User();

    expect(isModel(user)).to.be.true;
  });


  it('Returns false if the object is not an instance of BusinessModel', () => {
    const fake = new FakeModel();

    expect(isModel(fake)).to.not.be.true;
  });
});


describe('isModelClass', () => {
  class FakeModel {
    static props = {
      'key': {type: 'string'},
      'value': {type: 'string'}
    };
  }


  it('Returns true if the class is a subclass of BusinessModel', () => {
    expect(isModelClass(User)).to.be.true;
  });


  it('Returns false if the class is not a subclass of BusinessModel', () => {
    expect(isModelClass(FakeModel)).to.not.be.true;
  });
});
