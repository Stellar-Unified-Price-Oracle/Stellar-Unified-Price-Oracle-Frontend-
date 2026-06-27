const UNINITIALIZED = Symbol('uninitialized')

export function createSelector<State, Result>(
  inputSelectors: ((state: State) => unknown)[],
  combiner: (...args: unknown[]) => Result,
): (state: State) => Result {
  let lastInputs: unknown[] = []
  let lastResult: Result | typeof UNINITIALIZED = UNINITIALIZED

  return (state: State): Result => {
    const currentInputs = inputSelectors.map((fn) => fn(state))
    const changed = currentInputs.some((val, i) => !Object.is(val, lastInputs[i]))

    if (changed || lastResult === UNINITIALIZED) {
      lastResult = combiner(...currentInputs)
      lastInputs = currentInputs.map((v) => v)
    }

    return lastResult as Result
  }
}
