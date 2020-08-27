const { expect } = require('chai');
const { JsonModel, isModel, isModelClass } = require('../index');


class User extends JsonModel {
  static props = {
    'name': { type: 'string', default: 'John' },
    'surname': { type: 'string', default: 'Doe' },
    'fullName': { type: 'string', readOnly: true },
  };

  get fullName() {
    return `${this.name} ${this.surname}`;
  }
}


class Order extends JsonModel {
  static description = "Example nested model.";
  static props = {
    'id': { type: 'number', default: 1 },
    'user': { type: User },
  };
}


class Pizza extends JsonModel {
  static props = {
    'name': {type: 'string'},
    'ingredients': {type: 'array', items: {type: 'string'}},
  };
}


class Table extends JsonModel {
  static props = {
    'number': {type: 'number'},
    'people': {type: 'array', items: { type: User }},
  };
}


describe('BusinessModel', () => {
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


    it('Throws when the data does not match the schema', () => {
      expect(() => {
        new User({
          firstName: 'John',
          lastName: 'Doe',
        });
      }).to.throw();
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
      class TestModel extends JsonModel {
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
      class TestModel extends JsonModel {
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
      class Base extends JsonModel {
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
    });


    it('Subclass can override base class field', () => {
      class Base extends JsonModel {
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
      class A extends JsonModel { static props = { 'prop1': {type: 'string'} }; }
      class B extends A             { static props = { 'prop2': {type: 'string'} }; }
      class C extends B             { static props = { 'prop3': {type: 'string'} }; }

      const instance = new C({ prop1: 'value1', prop2: 'value2', prop3: 'value3' });

      expect(instance.prop1).to.equal('value1');
      expect(instance.prop2).to.equal('value2');
      expect(instance.prop3).to.equal('value3');
    });


    it('Works even if one of the classes does not specify props', () => {
      class A extends JsonModel { static props = { 'prop1': {type: 'string'} }; }
      class B extends A             { }
      class C extends B             { static props = { 'prop3': {type: 'string'} }; }

      const instance = new C({ prop1: 'value1', prop3: 'value3' });

      expect(instance.prop1).to.equal('value1');
      expect(instance.prop3).to.equal('value3');
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
        additionalProperties: false,
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

    it("Will not include description if not given", () => {
      const schema = User.getSchema();

      expect(schema.hasOwnProperty('description')).to.not.be.true;
    });

    it("Will include description if given", () => {
      const schema = Order.getSchema();

      expect(schema.description).to.equal('Example nested model.');
    });

    it('Can leave models in the schema.', () => {
      const schema = Order.getSchema({ leaveModels: true });

      expect(schema).to.eql({
        $schema: 'http://json-schema.org/schema#',
        $id: 'Order',
        type: 'object',
        additionalProperties: false,
        description: 'Example nested model.',
        properties: {
          'id': { type: 'number', default: 1 },
          'user': { type: User },
        },
      })
    });

    it('Passes down leaveModels configuration', () => {
      class DoubleNest extends JsonModel {
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
    })
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
