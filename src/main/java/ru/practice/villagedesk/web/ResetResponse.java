package ru.practice.villagedesk.web;

import tools.jackson.databind.JsonNode;

public record ResetResponse(long version, JsonNode state) {
}
