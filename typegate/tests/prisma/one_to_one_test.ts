// Copyright Metatype OÜ under the Elastic License 2.0 (ELv2). See LICENSE.md for usage.

import { Engine } from "../../src/engine.ts";
import { gql, MetaTest, recreateMigrations, test } from "../utils.ts";

async function runCommonTestSteps(t: MetaTest, e: Engine) {
  await t.should("drop schema and recreate", async () => {
    await gql`
      mutation a {
        dropSchema
      }
    `
      .expectData({
        dropSchema: 0,
      })
      .on(e);
    await recreateMigrations(e);
  });

  await t.should("create a record with a nested object", async () => {
    await gql`
      mutation {
        createUser(data: { id: 12, profile: { create: { id: 15 } } }) {
          id
        }
      }
    `
      .expectData({
        createUser: {
          id: 12,
        },
      })
      .on(e);

    await gql`
      query {
        findUniqueProfile(where: { id: 15 }) {
          id
          user {
            id
          }
        }
      }
    `
      .expectData({
        findUniqueProfile: {
          id: 15,
          user: {
            id: 12,
          },
        },
      })
      .on(e);
  });
}

test("required 1-1 relationships", async (t) => {
  const tgPath = "prisma/prisma_1_1.py";
  const e = await t.pythonFile(tgPath);

  await runCommonTestSteps(t, e);

  await t.should("delete fails with nested object", async () => {
    await gql`
      mutation {
        deleteUser(where: { id: 12 }) {
          id
        }
      }
    `
      .expectErrorContains("Foreign key constraint failed")
      .on(e);
  });
});

test("optional 1-1 relationships", async (t) => {
  const tgPath = "prisma/optional_1_1.py";
  const e = await t.pythonFile(tgPath);

  await runCommonTestSteps(t, e);

  // onDelete defaults to SetNull
  await t.should("delete row referenced by another row", async () => {
    await gql`
      mutation {
        deleteUser(where: { id: 12 }) {
          id
        }
      }
    `
      .expectData({
        deleteUser: {
          id: 12,
        },
      })
      .on(e);

    await gql`
      query {
        findUniqueProfile(where: {id: 15}) {
          id
          user {
            id
          }
        }
      }
    `
      .expectData({
        findUniqueProfile: {
          id: 15,
          user: null,
        },
      })
      .on(e);
  });
});
