import {
  Prisma,
  RunUpdateManyWithoutBenchmarkQueryInput,
  RunCreateManyWithoutBenchmarkQueryInput,
  Connector
} from "./binding";

const prismaServer = "https://benchmark-results_prisma-internal.prisma.sh";
const resultStorageEndpoint = prismaServer + "/benchmark/dev";
const resultStorage = new Prisma({
  endpoint: resultStorageEndpoint
});

export async function createBenchmarkingSession(queriesToRun: number) {
  return await resultStorage.mutation.createBenchmarkingSession({
    data: {
      queriesToRun: queriesToRun,
      queriesRun: 0,
      started: new Date()
    }
  });
}

export async function incrementQueriesRun(sessionId: string) {
  var currentCount = await resultStorage.query.benchmarkingSession({
    where: { id: sessionId }
  });
  return await resultStorage.mutation.updateBenchmarkingSession({
    where: {
      id: sessionId
    },
    data: {
      queriesRun: currentCount!.queriesRun + 1
    }
  });
}

export async function markSessionAsFinished(sessionId: string) {
  return await resultStorage.mutation.updateBenchmarkingSession({
    where: {
      id: sessionId
    },
    data: {
      finished: new Date()
    }
  });
}

export interface BenchmarkResult {
  rps: number;
  successes: number;
  failures: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

export async function storeBenchmarkResults(
  sessionId: string,
  connector: string,
  version: string,
  commit: string,
  importFile: number,
  queryName: string,
  query: string,
  results: BenchmarkResult[],
  startedAt: Date,
  finishedAt: Date
): Promise<void> {
  console.log(`storing ${results.length} results`);
  // const latencies = results.map(result => {
  //   const failures = Object.keys(result.vegetaResult.status_codes).reduce((accumulator, statusCode) => {
  //     if (statusCode != "200") {
  //       let value = result.vegetaResult.status_codes[statusCode];
  //       return value + accumulator;
  //     } else {
  //       return accumulator;
  //     }
  //   }, 0);
  //   return {
  //     rps: result.rps,
  //     avg: result.vegetaResult.latencies.mean,
  //     p50: result.vegetaResult.latencies["50th"],
  //     p95: result.vegetaResult.latencies["95th"],
  //     p99: result.vegetaResult.latencies["99th"],
  //     failures: failures,
  //     successes: result.vegetaResult.status_codes["200"]
  //   };
  // });

  const nestedCreateRun: RunUpdateManyWithoutBenchmarkQueryInput | RunCreateManyWithoutBenchmarkQueryInput = {
    create: [
      {
        connector: connector as Connector,
        startedAt: startedAt,
        finishedAt: finishedAt,
        version: version,
        commit: commit,
        importFile: importFile,
        latencies: {
          create: results
        },
        session: {
          connect: {
            id: sessionId
          }
        }
      }
    ]
  };
  const data = {
    where: { name: queryName },
    update: {
      runs: nestedCreateRun
    },
    create: {
      name: queryName,
      query: query,
      runs: nestedCreateRun
    }
  };
  await resultStorage.mutation.upsertBenchmarkedQuery(data);
}