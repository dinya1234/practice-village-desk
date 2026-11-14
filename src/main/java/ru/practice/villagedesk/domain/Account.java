package ru.practice.villagedesk.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "accounts")
public class Account {

	@Id
	private String id;

	@Column(nullable = false, unique = true)
	private String login;

	@Column(nullable = false)
	private String name;

	@Column(name = "shift_name", nullable = false)
	private String shift;

	@Column(name = "password_hash", nullable = false, length = 100)
	private String passwordHash;

	protected Account() {
	}

	public Account(String id, String login, String name, String shift, String passwordHash) {
		this.id = id;
		this.login = login;
		this.name = name;
		this.shift = shift;
		this.passwordHash = passwordHash;
	}

	public String getId() {
		return id;
	}

	public String getLogin() {
		return login;
	}

	public String getName() {
		return name;
	}

	public String getShift() {
		return shift;
	}

	public String getPasswordHash() {
		return passwordHash;
	}
}
