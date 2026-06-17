import { randomUUID } from "node:crypto";
import type { CountedTag, Tag, TagRenameResult } from "../../shared/types";
import type { VoiceNoterDatabase } from "./database";

type TagMutationResult<T> = {
  result: T;
  affectedItemIds: string[];
};

export function listTags(db: VoiceNoterDatabase): CountedTag[] {
  return db
    .prepare(
      `
        SELECT tags.id, tags.name, COUNT(item_tags.item_id) AS itemCount
        FROM tags
        LEFT JOIN item_tags ON item_tags.tag_id = tags.id
        GROUP BY tags.id, tags.name
        ORDER BY tags.name
      `,
    )
    .all() as CountedTag[];
}

export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function getOrCreateTag(db: VoiceNoterDatabase, name: string): Tag {
  const normalized = normalizeTagName(name);
  if (!normalized) {
    throw new Error("Tag name cannot be empty.");
  }

  const existing = db.prepare("SELECT id, name FROM tags WHERE name = ?").get(normalized) as Tag | undefined;
  if (existing) {
    return existing;
  }

  const tag = {
    id: randomUUID(),
    name: normalized,
  };
  db.prepare("INSERT INTO tags (id, name, created_at) VALUES (?, ?, ?)").run(tag.id, tag.name, new Date().toISOString());
  return tag;
}

export function replaceItemTagNames(db: VoiceNoterDatabase, itemId: string, tagNames: string[]): string[] {
  const normalizedNames = uniqueNormalizedTagNames(tagNames);
  db.transaction(() => {
    db.prepare("DELETE FROM item_tags WHERE item_id = ?").run(itemId);
    for (const tagName of normalizedNames) {
      const tag = getOrCreateTag(db, tagName);
      db.prepare("INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)").run(itemId, tag.id);
    }
  })();
  return [itemId];
}

export function assignTagNamesToItems(db: VoiceNoterDatabase, itemIds: string[], tagNames: string[]): string[] {
  const normalizedNames = uniqueNormalizedTagNames(tagNames);
  const uniqueItemIds = uniqueValues(itemIds);
  if (normalizedNames.length === 0 || uniqueItemIds.length === 0) {
    return [];
  }

  db.transaction(() => {
    const tags = normalizedNames.map((tagName) => getOrCreateTag(db, tagName));
    for (const itemId of uniqueItemIds) {
      for (const tag of tags) {
        db.prepare("INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)").run(itemId, tag.id);
      }
    }
  })();

  return uniqueItemIds;
}

export function removeTagNamesFromItems(db: VoiceNoterDatabase, itemIds: string[], tagNames: string[]): string[] {
  const normalizedNames = uniqueNormalizedTagNames(tagNames);
  const uniqueItemIds = uniqueValues(itemIds);
  if (normalizedNames.length === 0 || uniqueItemIds.length === 0) {
    return [];
  }

  const tags = normalizedNames
    .map((name) => db.prepare("SELECT id, name FROM tags WHERE name = ?").get(name) as Tag | undefined)
    .filter((tag): tag is Tag => Boolean(tag));
  if (tags.length === 0) {
    return [];
  }

  db.transaction(() => {
    const deleteStatement = db.prepare("DELETE FROM item_tags WHERE item_id = ? AND tag_id = ?");
    for (const itemId of uniqueItemIds) {
      for (const tag of tags) {
        deleteStatement.run(itemId, tag.id);
      }
    }
  })();

  return uniqueItemIds;
}

export function renameTag(db: VoiceNoterDatabase, tagId: string, nextName: string): TagMutationResult<TagRenameResult> {
  const current = getTagById(db, tagId);
  if (!current) {
    throw new Error(`Tag not found: ${tagId}`);
  }

  const normalized = normalizeTagName(nextName);
  if (!normalized) {
    throw new Error("Tag name cannot be empty.");
  }

  const affectedItemIds = getItemIdsForTag(db, tagId);
  const existing = db.prepare("SELECT id, name FROM tags WHERE name = ?").get(normalized) as Tag | undefined;

  if (existing && existing.id !== tagId) {
    db.transaction(() => {
      const insertAssignment = db.prepare("INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)");
      for (const itemId of affectedItemIds) {
        insertAssignment.run(itemId, existing.id);
      }
      db.prepare("DELETE FROM item_tags WHERE tag_id = ?").run(tagId);
      db.prepare("DELETE FROM tags WHERE id = ?").run(tagId);
    })();
    return {
      result: {
        tag: existing,
        mergedTagId: existing.id,
      },
      affectedItemIds,
    };
  }

  if (current.name !== normalized) {
    db.prepare("UPDATE tags SET name = ? WHERE id = ?").run(normalized, tagId);
  }

  return {
    result: {
      tag: { id: tagId, name: normalized },
      mergedTagId: null,
    },
    affectedItemIds,
  };
}

export function deleteTag(db: VoiceNoterDatabase, tagId: string): string[] {
  const affectedItemIds = getItemIdsForTag(db, tagId);
  db.transaction(() => {
    db.prepare("DELETE FROM item_tags WHERE tag_id = ?").run(tagId);
    db.prepare("DELETE FROM tags WHERE id = ?").run(tagId);
  })();
  return affectedItemIds;
}

function uniqueNormalizedTagNames(tagNames: string[]): string[] {
  return uniqueValues(tagNames.map(normalizeTagName).filter((name) => name.length > 0));
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function getTagById(db: VoiceNoterDatabase, tagId: string): Tag | undefined {
  return db.prepare("SELECT id, name FROM tags WHERE id = ?").get(tagId) as Tag | undefined;
}

function getItemIdsForTag(db: VoiceNoterDatabase, tagId: string): string[] {
  return (db.prepare("SELECT item_id FROM item_tags WHERE tag_id = ?").all(tagId) as Array<{ item_id: string }>).map((row) => row.item_id);
}
