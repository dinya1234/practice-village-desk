package ru.practice.villagedesk.web;

import tools.jackson.databind.JsonNode;

public record SnapshotResponse(AccountView account, long version, JsonNode state) {
}
