// Copyright Metatype OÜ under the Elastic License 2.0 (ELv2). See LICENSE.md for usage.

import { getLogger } from "../../log.ts";
import {
  FuncTask,
  ImportFuncTask,
  predefinedFuncs,
  PredefinedFuncTask,
  Task,
  TaskExec,
} from "./codes.ts";

let logger = getLogger("worker");
logger.info("start webworker");

let initData = null as unknown as { name: string };

type TaskModule = Record<string, TaskExec>;

const fns: Map<number, TaskExec> = new Map();
const mods: Map<number, TaskModule> = new Map();

// TODO: get worker name from events, for better logging

const execFunctions: Record<Task["type"], (task: Task) => Promise<unknown>> = {
  import_func: async (task: Task) => {
    const { id, moduleId, moduleCode, name, args, internals, verbose } =
      task as ImportFuncTask;
    if (!mods.has(moduleId)) {
      if (moduleCode == null) {
        throw new Error("module definition required for first reference");
      }
      mods.set(
        moduleId,
        await import(
          `data:text/javascript,${encodeURIComponent(moduleCode)}`
        ),
      );
    }

    verbose &&
      logger.info(`[${id}] exec func "${name}" from module ${moduleId}`);
    const mod = mods.get(moduleId)!;
    return await mod[name](args, internals);
  },

  func: async (task: Task) => {
    const { id, fnId, code, args, internals, verbose } = task as FuncTask;
    if (!fns.has(fnId)) {
      if (code == null) {
        throw new Error("function definition required");
      }
      fns.set(
        fnId,
        new Function(`"use strict"; ${code}; return _my_lambda;`)(),
      );
    }

    verbose && logger.info(`[${id}] exec func "${fnId}"`);
    return await fns.get(fnId)!(args, internals);
  },

  predefined_func: (task: Task) => {
    const { id, name, args, internals, verbose } = task as PredefinedFuncTask;
    verbose && logger.info(`[${id}] exec predefined func "${name}"`);
    return Promise.resolve(predefinedFuncs[name](args, internals));
  },
};

self.onmessage = async (evt: MessageEvent<Task>) => {
  if (initData == null) {
    initData = evt.data as typeof initData;
    logger = getLogger(`worker (${initData.name})`);
    return;
  }

  const { id, type } = evt.data;
  const exec = execFunctions[type];

  if (exec == null) {
    self.postMessage({
      id,
      error: `unsupported task type "${evt.data.type}"`,
    });
  }

  try {
    const value = await exec(evt.data);
    self.postMessage({ id, value });
  } catch (err) {
    self.postMessage({ id, error: err.message });
  }
};
