package ru.practice.villagedesk.web;

import tools.jackson.databind.JsonNode;

public record LoginResponse(String token, AccountView account, long version, JsonNode state) {
}
