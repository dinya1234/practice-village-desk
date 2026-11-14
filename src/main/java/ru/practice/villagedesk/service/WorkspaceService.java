package ru.practice.villagedesk.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ru.practice.villagedesk.domain.Workspace;
import ru.practice.villagedesk.repository.WorkspaceRepository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Service
public class WorkspaceService {

	private final WorkspaceRepository workspaces;
	private final SeedService seedService;
	private final ObjectMapper objectMapper;

	public WorkspaceService(WorkspaceRepository workspaces, SeedService seedService, ObjectMapper objectMapper) {
		this.workspaces = workspaces;
		this.seedService = seedService;
		this.objectMapper = objectMapper;
	}

	@Transactional(readOnly = true)
	public Snapshot snapshot() {
		Workspace workspace = requireWorkspace();
		return new Snapshot(workspace.getVersion(), read(workspace));
	}

	@Transactional
	public SaveResult save(long expectedVersion, JsonNode state) {
		Workspace workspace = workspaces.findForUpdate(1L)
			.orElseThrow(() -> new IllegalStateException("Состояние не создано"));
		if (workspace.getVersion() != expectedVersion) {
			return SaveResult.conflict(workspace.getVersion(), read(workspace));
		}
		workspace.update(workspace.getVersion() + 1, objectMapper.writeValueAsString(state));
		return SaveResult.saved(workspace.getVersion());
	}

	@Transactional
	public ResetResult reset() {
		Workspace workspace = workspaces.findForUpdate(1L)
			.orElseThrow(() -> new IllegalStateException("Состояние не создано"));
		JsonNode seed = seedService.seed();
		workspace.update(workspace.getVersion() + 1, objectMapper.writeValueAsString(seed));
		return new ResetResult(workspace.getVersion(), seed);
	}

	private Workspace requireWorkspace() {
		return workspaces.findById(1L).orElseThrow(() -> new IllegalStateException("Состояние не создано"));
	}

	private JsonNode read(Workspace workspace) {
		return objectMapper.readTree(workspace.getStateJson());
	}

	public record Snapshot(long version, JsonNode state) {
	}

	public record SaveResult(boolean saved, long version, JsonNode state) {

		public static SaveResult saved(long version) {
			return new SaveResult(true, version, null);
		}

		public static SaveResult conflict(long version, JsonNode state) {
			return new SaveResult(false, version, state);
		}
	}

	public record ResetResult(long version, JsonNode state) {
	}
}
