/*
 * Copyright 2020 Mateusz Klos
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const jsonschema = require('jsonschema');
const util = require('./util');


// A little helper to manage JSONSchema string formats.
class FormatManager {
  constructor() {
    this.formats = {};
  }

  // Register new string format with the given name
  register(name, { toString, fromString }) {
    this.formats[name] = { toString, fromString };
  }

  // Find string format by name.
  find(name) {
    return this.formats[name];
  }
}


// Base class for app models.
class TypedModel {
  static formats = new FormatManager();

  constructor(values) {
    values = values || {};

    const schema = this.constructor.getSchema({ leaveModels: true });

    Object.entries(buildObject('$', schema, values, {'#': this.constructor}))
      .forEach(([name, value]) => {
        // Do not try to write read only props.
        const prop = Object.getOwnPropertyDescriptor(this, name);
        if (!prop || prop.writable) {
          this[name] = value;
        }
      });
  }

  // Return all properties including inherited from the parent class.
  static get allProps() {
    return util.mapObject(
      {
        // Inherit props from the base class.
        ...collectBaseProps(this),
        ...this.props,
      },
      // Filter out props set to undefined so they are not part of the schema.
      (name, value) => value === undefined ? undefined : [name, value]
    );
  }

  // Get JSON schema for this type.
  //
  // leaveModels will prevent child types to be converted to schemas
  static getSchema({ leaveModels = false } = {}) {
    return {
      $schema: 'http://json-schema.org/schema#',
      $id: this.name,
      type: 'object',
      properties: util.mapObject(this.allProps, (name, value) => ([
        name,
        (isModelClass(value.type) && !leaveModels)
          // We don't need to pass leaveModels as if models are left, we will never
          // go deeper to use getSchema()
          ? value.type.getSchema()
          : value
      ])),
      additionalProperties: false,
      // You can customize the schema using static schema property.
      ...(this.schema || {}),
    }
  }

  // Convert the model instance to a plain JS object.
  asObject() {
    return Object.entries(this.constructor.allProps)
      .reduce((result, [name, propSchema]) => {
        const value = this[name];
        let processed;

        if (value === undefined)
          processed = undefined;
        else if (isModelClass(propSchema.type))
          processed = value.asObject();
        else if (propSchema.type === 'string' && propSchema.format && typeof value !== 'string') {
          const format = TypedModel.formats.find(propSchema.format);
          processed = format ? format.toString(value) : value.toString();
        }
        else
          processed = value;

        return { ...result, [name]: processed };
      }, {});
  }

  // Convert the instance of the model to a JSON string representation.
  asJson(indent) {
    return JSON.stringify(this.asObject(), null, indent);
  }

  // Validate a given set of values against the model schema.
  static validate(values) {
    const err = jsonschema.validate(values, this.getSchema());

    return (err.errors.length > 0) ? err : undefined;
  }
}


const isModel = obj => obj instanceof TypedModel;
const isModelClass = cls => cls.prototype instanceof TypedModel;


// Collect properties from all base classes of the given model class.
function collectBaseProps(ModelCls) {
  const baseClasses = [];

  for (let b = Object.getPrototypeOf(ModelCls); b !== TypedModel; b = Object.getPrototypeOf(b)) {
    baseClasses.push(b);
  }

  let props = {};
  for (let i = baseClasses.length - 1; i >= 0; --i) {
    props = { ...props, ...baseClasses[i].props };
  }

  return props;
}


// Build an object based on values and a given schema.
//
// This will use defaults from the schema as well as convert all nested models
// to instances of corresponding model classes.
function buildObject(name, schema, values, refs) {
  return Object.entries(schema.properties)
    // Skip read only fields. We should not try to write them.
    .filter(([_, propSchema]) => !propSchema.readOnly)
    .reduce((result, [propName, propSchema]) => ({
      ...result,
      [propName]: buildValue(`${name}.${propName}`, propSchema, values[propName], refs)
    }), {});
}


// Build a single value based on the schema and the given value.
function buildValue(name, schema, value, refs) {
  try {
    if (value === undefined)
      value = (typeof schema.default === 'function') ? schema.default() : schema.default;

    if (!schema.type && schema.$ref)
      schema = { type: refs[schema.$ref] };

    if (schema.type === 'array')
      return (value === undefined) ? [] : buildArray(name, schema, value, refs);

    if (value === undefined || schema === undefined)
      return undefined;

    if (schema.type === 'object')
      return buildObject(name, schema, value, refs);

    if (isModelClass(schema.type))
      return new schema.type(value);

    if (schema.type === 'string' && schema.format) {
      const format = TypedModel.formats.find(schema.format);
      return format ? format.fromString(value) : value;
    }

    return value;
  }
  catch(err) {
    err.traceback = err.traceback || [];
    err.traceback.push(name);
    throw err
  }
}


// Convert JSON array into a proper array object (with nested models properly
// instantiated.
function buildArray(name, schema, data, refs) {
  try {
    return data.map((x, idx) => (
      buildValue(`${name}[${idx}]`, schema.items, x, refs)
    ));
  } catch (err) {
    err.traceback = err.traceback || [];
    err.traceback.push(name);
    throw err
  }
}

// handle date and date-time formats out of the box (can be overwritten).
TypedModel.formats.register('date', {
  fromString: str => new Date(str),
  toString: value => {
    const datestr = value.toISOString();
    return datestr.substr(0, datestr.indexOf('T'));
  },
});
TypedModel.formats.register('date-time', {
  fromString: str => new Date(str),
  toString: value => value.toISOString(),
});


module.exports = {
  TypedModel,
  isModel,
  isModelClass,
};
