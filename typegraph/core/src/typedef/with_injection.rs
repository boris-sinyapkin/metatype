// Copyright Metatype OÜ, licensed under the Mozilla Public License Version 2.0.
// SPDX-License-Identifier: MPL-2.0

use crate::{
    conversion::types::TypeConversion,
    errors::Result,
    typegraph::TypegraphContext,
    types::{TypeData, TypeId, WithInjection, WrapperTypeData},
    wit::core::TypeWithInjection,
};
use common::typegraph::{EffectType, Injection, InjectionData, SingleValue, TypeNode};

use std::collections::HashMap;

impl TypeConversion for WithInjection {
    fn convert(&self, ctx: &mut TypegraphContext, runtime_id: Option<u32>) -> Result<TypeNode> {
        let tpe = TypeId(self.data.tpe).as_type()?;
        let mut type_node = tpe.convert(ctx, runtime_id)?;
        let base = type_node.base_mut();
        let value: Injection =
            serde_json::from_str(&self.data.injection).map_err(|e| e.to_string())?;
        match value {
            Injection::Parent(data) => {
                let get_correct_id = |v: u32| -> Result<u32> {
                    let id = TypeId(v).resolve_proxy()?;
                    if let Some(index) = ctx.find_type_index_by_store_id(id) {
                        return Ok(index);
                    }
                    Err(format!("unable to find type for store id {}", id.0).into())
                };
                let new_data = match data {
                    InjectionData::SingleValue(SingleValue { value }) => {
                        InjectionData::SingleValue(SingleValue {
                            value: get_correct_id(value)?,
                        })
                    }
                    InjectionData::ValueByEffect(per_effect) => {
                        let mut new_per_effect: HashMap<EffectType, u32> = HashMap::new();
                        for (k, v) in per_effect.iter() {
                            new_per_effect.insert(*k, get_correct_id(*v)?);
                        }
                        InjectionData::ValueByEffect(new_per_effect)
                    }
                };
                base.injection = Some(Injection::Parent(new_data));
            }

            Injection::Secret(data) => {
                match &data {
                    InjectionData::SingleValue(SingleValue { value }) => {
                        ctx.add_secret(value);
                    }
                    InjectionData::ValueByEffect(per_effect) => {
                        for (_, v) in per_effect.iter() {
                            ctx.add_secret(v);
                        }
                    }
                }
                base.injection = Some(Injection::Secret(data));
            }
            _ => {
                base.injection = Some(value);
            }
        }
        Ok(type_node)
    }
}

impl TypeData for TypeWithInjection {
    fn get_display_params_into(&self, params: &mut Vec<String>) {
        let value: Injection = serde_json::from_str(&self.injection).unwrap();
        let gen_display = |data: InjectionData<String>| match data {
            InjectionData::SingleValue(t) => t.value,
            InjectionData::ValueByEffect(t) => {
                let mut res: Vec<String> = vec![];
                for (effect, value) in t.iter() {
                    res.push(format!("{:?}:{}", effect, value));
                }
                res.join(", ")
            }
        };

        let gen_display_u32 = |data: InjectionData<u32>| match data {
            InjectionData::SingleValue(t) => t.value.to_string(),
            InjectionData::ValueByEffect(t) => {
                let mut res: Vec<String> = vec![];
                for (effect, value) in t.iter() {
                    res.push(format!("{:?}:{}", effect, value));
                }
                res.join(", ")
            }
        };

        params.push(format!(
            "injection='[{}]'",
            match value {
                Injection::Static(data) => format!("static={}", gen_display(data)),
                Injection::Context(data) => format!("context={}", gen_display(data)),
                Injection::Secret(data) => format!("secret={}", gen_display(data)),
                Injection::Dynamic(data) => format!("dynamic={}", gen_display(data)),
                Injection::Parent(data) => format!("parent={}", gen_display_u32(data)),
            },
        ));
    }

    fn variant_name(&self) -> String {
        "injection".to_string()
    }

    super::impl_into_type!(wrapper, WithInjection);
}

impl WrapperTypeData for TypeWithInjection {
    fn resolve(&self) -> Option<TypeId> {
        Some(self.tpe.into())
    }
}
