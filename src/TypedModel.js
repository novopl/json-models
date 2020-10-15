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
import util from './util';


// Base class for app models.
export class TypedModel {
  static formats = new util.FormatManager();

  constructor(values) {
    values = values || {};
    const schema = this.constructor.getSchema({ leaveModels: true });
    const processedValues = buildObject('$', schema, values, {'#': this.constructor});

    this.setValues(processedValues);
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
    const schema = {
      $schema: 'http://json-schema.org/schema#',
      $id: this.name,
      type: 'object',
      additionalProperties: false,
      // You can customize the schema using static schema property.
      ...(this.schema || {}),
    };

    if (!util.isEmpty(this.allProps)) {
      schema.properties = util.mapObject(this.allProps, (name, value) => ([
        name,
        (isModelClass(value.type) && !leaveModels)
          // We don't need to pass leaveModels as if models are left, we will never
          // go deeper to use getSchema()
          ? value.type.getSchema()
          : value
      ]));
    }

    return schema;
  }

  // Convert the model instance to a plain JS object.
  asObject() {
    return modelAsObject(this);
  }

  // A quick converter for plain objects.
  //
  // ModelCls.asObject(data) will transform the data according to ModelCls
  // schema and then convert it to plain JS object.
  static asObject(data) {
    const instance = new this(data);
    return instance.asObject();
  }

  // @deprecated see .asJsonStr()
  asJson(indent) {
    return this.asJsonStr(indent);
  }

  asJsonStr(indent) {
    return JSON.stringify(this.asObject(), null, indent);
  }

  setValues(values) {
    // Set values differs from the constructor in that it won't fill in defaults
    // if something is missing in the given values. It will simply not set those
    // missing fields.
    const schema = this.constructor.getSchema({ leaveModels: true });
    const refs = {'#': this.constructor};

    let processed = {};

    // If properties are not defined and we're not explicitly forbidding
    // additional props then we just assume we should return all values.
    if (!schema.properties && schema.additionalProperties !== false) {
      processed = values;
    } else {
      processed = Object.entries(schema.properties)
        // Skip read only fields and those that are not present in *values*.
        .filter(([propName, propSchema]) => (
          Object.prototype.hasOwnProperty.call(values, propName)
          && !propSchema.readOnly
        ))
        .reduce((result, [propName, propSchema]) => ({
          ...result,
          [propName]: buildValue(`$.${propName}`, propSchema, values[propName], refs)
        }), {});
    }

    Object.entries(processed).map(([name, value]) => {
      this[name] = value
    });
  }
}


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
  // If properties are not defined and we're not explicitly forbidding
  // additional props then we just assume we should return all values.
  if (!schema.properties && schema.additionalProperties !== false) {
    return values;
  }
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

    if (value === undefined)
      return undefined;

    if (schema.type === 'object')
      return buildObject(name, schema, value, refs);

    if (isModelClass(schema.type))
      return new schema.type(value);

    if (schema.type === 'string' && schema.format) {
      return TypedModel.formats.loadValue(schema.format, value);
    }

    return value;
  }
  catch(err) {
    // On the first catch, the name will be the most nested, do not overwrite it
    // Inside the parent catch (values can be nested via arrays and objects).
    if (!err.traceback) {
      err.traceback = name;
    }
    // err.traceback = err.traceback || '';
    // if (!err.traceback.startsWith(name))
    // err.traceback.push(name);
    throw err
  }
}


// Convert JSON array into a proper array object (with nested models properly
// instantiated.
function buildArray(name, schema, data, refs) {
  return data.map((x, idx) => (
    buildValue(`${name}[${idx}]`, schema.items, x, refs)
  ));
}


export function modelAsObject(model) {
  const schema = model.constructor.getSchema();
  if (!schema.properties && schema.additionalProperties !== false) {
    return { ...model };
  } else {
    return Object.entries(model.constructor.allProps)
      .reduce((result, [name, propSchema]) => {
        const value = model[name];
        let processed;

        if (value === undefined || value === null)
          processed = value;
        else if (isModelClass(propSchema.type))
          processed = modelAsObject(value);
        else if (propSchema.type === 'string' && typeof value !== 'string') {
          const format = TypedModel.formats.find(propSchema.format);
          processed = format ? format.dump(value) : (value && value.toString());
        }
        else
          processed = value;

        return { ...result, [name]: processed };
      }, {});
  }
}


export const isModel = obj => obj instanceof TypedModel;
export const isModelClass = cls => cls.prototype instanceof TypedModel;


// handle date and date-time formats out of the box (can be overwritten).
TypedModel.formats.register('date', {
  load: str => str && new Date(str),
  dump: val => val && util.formatDate(val, 'yyyy-MM-dd'),
});
TypedModel.formats.register('date-time', {
  load: str => str && new Date(str),
  dump: val => val && val.toISOString(),
});
