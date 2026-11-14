package ru.practice.villagedesk.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "workspace")
public class Workspace {

	@Id
	private Long id;

	@Column(nullable = false)
	private long version;

	@Column(name = "state_json", nullable = false, length = 1000000)
	private String stateJson;

	protected Workspace() {
	}

	public Workspace(Long id, long version, String stateJson) {
		this.id = id;
		this.version = version;
		this.stateJson = stateJson;
	}

	public Long getId() {
		return id;
	}

	public long getVersion() {
		return version;
	}

	public String getStateJson() {
		return stateJson;
	}

	public void update(long version, String stateJson) {
		this.version = version;
		this.stateJson = stateJson;
	}
}
