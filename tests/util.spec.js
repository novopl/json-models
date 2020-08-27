const { expect } = require('chai');
const util = require('../util');


describe('json()', () => {
  it('Converts data to JSON string', () => {
    const data = { test: 'value' };
    const jsonStr = util.json(data);

    expect(jsonStr).to.equal(JSON.stringify(data));
  });

  it('Accepts indentation as extra param', () => {
    const data = { test: 'value' };
    const jsonStr = util.json(data, 2);

    expect(jsonStr).to.equal(JSON.stringify(data, null, 2));
  });

});


describe('mapObject()', () => {
  it("Returns a clone if mapper doesn't change anything", () => {
    const obj = {
      prop1: 'value1',
      prop2: 'value2',
      prop3: 'value3',
    };
    const result = util.mapObject(obj, (name, value) => [name, value]);

    expect(result).to.not.equal(obj);
    expect(result).to.eql(obj);
  });

  it("Can modify the value", () => {
    const obj = {
      prop1: 'value1',
      prop2: 'value2',
      prop3: 'value3',
    };
    const result = util.mapObject(obj, (name, value) => [name, '--> ' + value]);

    expect(result).to.eql({
      prop1: '--> value1',
      prop2: '--> value2',
      prop3: '--> value3',
    });
  });

  it("Can modify the prop name", () => {
    const obj = {
      prop1: 'value1',
      prop2: 'value2',
      prop3: 'value3',
    };
    const result = util.mapObject(obj, (name, value) => [name + '_mod', value]);

    expect(result).to.eql({
      prop1_mod: 'value1',
      prop2_mod: 'value2',
      prop3_mod: 'value3',
    });
  });
});


