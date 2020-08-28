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


class FormatManager {
  constructor() {
    this.formats = {};
  }

  register(name, { toString, fromString }) {
    this.formats[name] = { toString, fromString };
  }

  find(name) {
    return this.formats[name];
  }
}


class TypedModel {
  static formats = new FormatManager();

  constructor(values) {
    values = values || {};

    const schema = this.constructor.getSchema({ leaveModels: true });
    Object.assign(this, buildObject(schema, values, {'#': this.constructor}));
  }

  static get allProps() {
    // Inherit props from the base class.
    return util.mapObject(
      {
        ...collectBaseProps(this),
        ...this.props,
      },
      // Filter out props set to undefined so they are not part of the schema.
      (name, value) => value === undefined ? undefined : [name, value]
    );
  }

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

  asObject() {
    return util.mapObject(this.constructor.allProps, (name, propSchema) => {
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

      return [ name, processed ];
    });
  }

  asJson(indent) {
    return JSON.stringify(this.asObject(), null, indent);
  }

  static validate(values) {
    const err = jsonschema.validate(values, this.getSchema());

    return (err.errors.length > 0) ? err : undefined;
  }
}


const isModel = obj => obj instanceof TypedModel;
const isModelClass = cls => cls.prototype instanceof TypedModel;


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


function buildObject(schema, values, refs) {
  return Object.entries(schema.properties)
    // Skip read only fields. We should not try to write them.
    .filter(([_, propSchema]) => !propSchema.readOnly)
    .reduce((result, [propName, propSchema]) => ({
      ...result,
      [propName]: buildValue(propSchema, values[propName], refs)
    }), {});
}


function buildValue(schema, value, refs) {
  if (value === undefined)
    value = schema.default;

  if (value === undefined || schema === undefined)
    return undefined;

  if (!schema.type && schema.$ref)
    schema = { type: refs[schema.$ref] };

  if (schema.type === 'array')
    return buildArray(schema, value, refs);

  if (schema.type === 'object')
    return buildObject(schema, value, refs);

  if (isModelClass(schema.type))
    return new schema.type(value);

  if (schema.type === 'string' && schema.format) {
    const format = TypedModel.formats.find(schema.format);
    return format ? format.fromString(value) : value;
  }

  return value;
}


function buildArray(schema, data, refs) {
  return data.map((x, idx) => (
    buildValue(schema.items, x, refs)
  ));
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
