import { makeArchiveRecord, makeRelationEdge } from "./archive-model.js";

const DB_NAME = "gpt-explain-library";
const DB_VERSION = 1;
const RECORDS = "records";
const EDGES = "edges";

let databasePromise = null;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"));
  });
}

export function openArchiveDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(RECORDS)) {
        const records = database.createObjectStore(RECORDS, { keyPath: "id" });
        records.createIndex("updatedAt", "updatedAt");
        records.createIndex("sourceDomain", "sourceDomain");
      }
      if (!database.objectStoreNames.contains(EDGES)) {
        const edges = database.createObjectStore(EDGES, { keyPath: "id" });
        edges.createIndex("fromRecordId", "fromRecordId");
        edges.createIndex("toRecordId", "toRecordId");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      databasePromise = null;
      reject(request.error || new Error("Cannot open the local explanation library"));
    };
  });
  return databasePromise;
}

export async function putArchiveState(state) {
  const database = await openArchiveDatabase();
  const transaction = database.transaction(RECORDS, "readwrite");
  transaction.objectStore(RECORDS).put(makeArchiveRecord(state));
  await transactionDone(transaction);
}

export async function putArchiveEdge(parentRecordId, childRecordId, anchor, createdAt) {
  const edge = makeRelationEdge(parentRecordId, childRecordId, anchor, createdAt);
  if (!edge) return null;
  const database = await openArchiveDatabase();
  const transaction = database.transaction(EDGES, "readwrite");
  transaction.objectStore(EDGES).put(edge);
  await transactionDone(transaction);
  return edge;
}

export async function getArchiveRecord(recordId) {
  if (!recordId) return null;
  const database = await openArchiveDatabase();
  const transaction = database.transaction(RECORDS, "readonly");
  return (await requestResult(transaction.objectStore(RECORDS).get(recordId))) || null;
}

export async function listArchiveRecords() {
  const database = await openArchiveDatabase();
  const transaction = database.transaction(RECORDS, "readonly");
  const records = await requestResult(transaction.objectStore(RECORDS).getAll());
  return records.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function listArchiveEdges() {
  const database = await openArchiveDatabase();
  const transaction = database.transaction(EDGES, "readonly");
  return requestResult(transaction.objectStore(EDGES).getAll());
}

async function edgesByIndex(indexName, recordId) {
  const database = await openArchiveDatabase();
  const transaction = database.transaction(EDGES, "readonly");
  return requestResult(transaction.objectStore(EDGES).index(indexName).getAll(recordId));
}

export function getIncomingEdges(recordId) {
  return edgesByIndex("toRecordId", recordId);
}

export function getOutgoingEdges(recordId) {
  return edgesByIndex("fromRecordId", recordId);
}

export async function getRecordRelations(recordId) {
  const [incoming, outgoing] = await Promise.all([
    getIncomingEdges(recordId),
    getOutgoingEdges(recordId)
  ]);
  const ids = [...new Set([
    ...incoming.map((edge) => edge.fromRecordId),
    ...outgoing.map((edge) => edge.toRecordId)
  ])];
  const records = await Promise.all(ids.map((id) => getArchiveRecord(id)));
  const recordsById = new Map(records.filter(Boolean).map((record) => [record.id, record]));
  const summary = (record) => record ? {
    id: record.id,
    title: record.title,
    source: record.source ? {
      text: String(record.source.text || "").slice(0, 240),
      title: record.source.title || "",
      url: record.source.url || ""
    } : null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  } : null;
  return {
    parent: incoming.length ? {
      edge: incoming[0],
      record: summary(recordsById.get(incoming[0].fromRecordId))
    } : null,
    children: outgoing.map((edge) => ({
      edge,
      record: summary(recordsById.get(edge.toRecordId))
    })).filter((relation) => relation.record)
  };
}

export async function deleteArchiveRecord(recordId) {
  const database = await openArchiveDatabase();
  const transaction = database.transaction([RECORDS, EDGES], "readwrite");
  transaction.objectStore(RECORDS).delete(recordId);
  const edgeStore = transaction.objectStore(EDGES);
  const edges = await requestResult(edgeStore.getAll());
  for (const edge of edges) {
    if (edge.fromRecordId === recordId || edge.toRecordId === recordId) edgeStore.delete(edge.id);
  }
  await transactionDone(transaction);
}
