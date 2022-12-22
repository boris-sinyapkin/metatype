// Copyright Metatype OÜ under the Elastic License 2.0 (ELv2). See LICENSE.md for usage.

import { Runtime } from "./Runtime.ts";
import * as native from "native";
import { FromVars, GraphQLRuntime } from "./graphql.ts";
import { ResolverError } from "../errors.ts";
import { Resolver, RuntimeInitParams } from "../types.ts";
import { nativeResult } from "../utils.ts";

const makeDatasource = (uri: string) => {
  const engine = (() => {
    if (uri.startsWith("postgres")) {
      return "postgresql";
    }
  })();
  return `
  datasource db {
    provider = "${engine}"
    url      = "${uri}"
  }
  `;
};

export class PrismaRuntime extends GraphQLRuntime {
  datamodel: string;
  key: string;

  private constructor(datamodel: string) {
    super("");
    this.disableVariables();
    this.datamodel = datamodel;
    this.key = "";
  }

  static async init(params: RuntimeInitParams): Promise<Runtime> {
    const { typegraph, args } = params;
    const schema = `${args.datasource}${args.datamodel}`;
    //console.log(schema);
    const instance = new PrismaRuntime(schema);
    await instance.registerEngine(typegraph.types[0].title);
    return instance;
  }

  async deinit(): Promise<void> {
    await this.unregisterEngine();
  }

  static async introspection(uri: string): Promise<string> {
    const intro = await native.prisma_introspection({
      datamodel: makeDatasource(uri),
    });
    return intro.introspection;
  }

  async registerEngine(typegraphName: string): Promise<void> {
    const conn = nativeResult(
      await native.prisma_register_engine({
        datamodel: this.datamodel,
        typegraph: typegraphName,
      }),
    );
    this.key = conn.engine_id;
  }

  async unregisterEngine(): Promise<void> {
    if (this.key === "") {
      throw new Error("unregistering unregistered engine");
    }
    const ret = await native.prisma_unregister_engine({
      key: this.key,
    });
    if ("Err" in ret) {
      throw new Error(ret.Err.message);
    }
    this.key = "";
  }

  execute(query: string | FromVars<string>, path: string[]): Resolver {
    // throw new Error(`path is ${path}`);
    return async ({ _: { variables } }) => {
      const startTime = performance.now();
      const q = typeof query === "function" ? query(variables) : query;
      console.log(`remote graphql: ${q}`);

      const ret = nativeResult(
        await native.prisma_query({
          key: this.key,
          query: {
            query: q,
            variables: {}, // TODO: remove this
          },
          datamodel: this.datamodel,
        }),
      );
      const endTime = performance.now();
      console.log(`queried prisma in ${(endTime - startTime).toFixed(2)}ms`);
      const res = JSON.parse(ret.res);
      if ("errors" in res) {
        throw new ResolverError(
          res.errors
            .map((e: any) => e.user_facing_error?.message ?? e.error)
            .join("\n"),
        );
      }
      console.log("EXECUTE: path=", path);
      console.log({ res });
      return path.reduce((r, field) => r[field], res.data);
      // return res.data;
    };
  }
}
