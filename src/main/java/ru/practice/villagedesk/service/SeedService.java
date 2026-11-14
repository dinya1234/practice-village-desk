package ru.practice.villagedesk.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ru.practice.villagedesk.domain.Account;
import ru.practice.villagedesk.domain.Workspace;
import ru.practice.villagedesk.repository.AccountRepository;
import ru.practice.villagedesk.repository.WorkspaceRepository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

@Service
public class SeedService {

	private static final String DATA_FILE = "static/data.js";

	private final AccountRepository accounts;
	private final WorkspaceRepository workspaces;
	private final PasswordEncoder passwordEncoder;
	private final ObjectMapper objectMapper;

	public SeedService(AccountRepository accounts, WorkspaceRepository workspaces, PasswordEncoder passwordEncoder,
			ObjectMapper objectMapper) {
		this.accounts = accounts;
		this.workspaces = workspaces;
		this.passwordEncoder = passwordEncoder;
		this.objectMapper = objectMapper;
	}

	@Transactional
	public void initialize() {
		if (accounts.count() == 0) {
			accounts.save(new Account("a-1", "olga", "Ольга С.", "Первая смена", passwordEncoder.encode("smena1")));
			accounts.save(new Account("a-2", "dmitry", "Дмитрий К.", "Вторая смена", passwordEncoder.encode("smena2")));
		}
		if (!workspaces.existsById(1L)) {
			workspaces.save(new Workspace(1L, 1L, objectMapper.writeValueAsString(seed())));
		}
	}

	public JsonNode seed() {
		Resource resource = new ClassPathResource(DATA_FILE);
		String code;
		try (InputStream input = resource.getInputStream()) {
			code = new String(input.readAllBytes(), StandardCharsets.UTF_8);
		} catch (IOException error) {
			throw new IllegalStateException("Не удалось прочитать data.js", error);
		}
		int start = code.indexOf('{');
		int end = code.lastIndexOf('}');
		if (start < 0 || end < start) {
			throw new IllegalStateException("В data.js нет объекта");
		}
		JsonNode source = objectMapper.readTree(code.substring(start, end + 1));
		ObjectNode seed = objectMapper.createObjectNode();
		seed.set("residents", arrayOrEmpty(source, "residents"));
		seed.set("workers", arrayOrEmpty(source, "workers"));
		seed.set("tickets", arrayOrEmpty(source, "tickets"));
		seed.set("calls", arrayOrEmpty(source, "calls"));
		seed.putArray("queue");
		seed.putNull("current");
		seed.putArray("usedLines");
		return seed;
	}

	private JsonNode arrayOrEmpty(JsonNode source, String field) {
		JsonNode value = source.get(field);
		return value != null && value.isArray() ? value : objectMapper.createArrayNode();
	}
}
