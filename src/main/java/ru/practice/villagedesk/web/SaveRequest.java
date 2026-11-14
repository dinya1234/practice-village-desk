package ru.practice.villagedesk.web;

import jakarta.validation.constraints.NotNull;

import tools.jackson.databind.JsonNode;

public record SaveRequest(@NotNull Long version, @NotNull JsonNode state) {
}
