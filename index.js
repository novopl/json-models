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


class TypedModel {
  constructor(values) {
    values = values || {};
    const errors = this.constructor.validate(values);

    if (errors) {
      throw new Error(`Invalid values: ${util.json(values, 2)}: ${util.json(errors, 2)}`);
    }

    const schema = this.constructor.getSchema({ leaveModels: true });
    Object.assign(this, buildObject(schema, values));
  }

  static getSchema({ leaveModels = false } = {}) {
    // Inherit props from the base class.
    const props = {
      ...collectBaseProps(this),
      ...this.props,
    };

    return {
      $schema: 'http://json-schema.org/schema#',
      $id: this.name,
      type: 'object',
      properties: util.mapObject(props, (name, value) => ([
        name,
        (isModelClass(value.type) && !leaveModels)
          // We don't need to pass leaveModels as if models are left, we will never
          // go deeper to use getSchema()
          ? value.type.getSchema()
          : value
      ])),
      additionalProperties: false,
      // We do not want to have a description field if not given. Setting it
      // to undefined will create it, it just won't show in many places.
      ...(this.description ? {description: this.description} : {}),
    }
  }

  asObject() {
    return util.mapObject(this.constructor.props, (name, propSchema) => {
      const value = this[name];
      const processed = (value === undefined)
        ? undefined
        : isModelClass(propSchema.type)
          ? value.asObject()
          : value;
      return [ name, processed ];
    });
  }

  asJson(indent) {
    return JSON.stringify(this.asObject(), null, indent);
  }

  static validate(values) {
    const result = jsonschema.validate(values, this.getSchema());

    return (result.errors.length > 0) ? result.errors : undefined;
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


function buildObject(schema, values) {
  const result = {};

  Object.entries(schema.properties)
    // Skip read only fields. We should not try to write them.
    .filter(([_, propSchema]) => !propSchema.readOnly)
    .forEach(([name, propSchema]) => {
      result[name] = buildValue(propSchema, values[name]);
    });

  return result;
}


function buildValue(schema, value) {
  if (value === undefined)
    value = schema.default;

  if (value === undefined)
    return undefined;

  else if (schema.type === 'array')
    return buildArray(schema, value);

  else if (schema.type === 'object')
    return buildObject(schema, value);

  else if (isModelClass(schema.type))
    return new schema.type(value);

  else
    return value;
}


function buildArray(schema, data) {
  return data.map(x => buildValue(schema.items, x));
}


module.exports = {
  TypedModel,
  isModel,
  isModelClass,
};
