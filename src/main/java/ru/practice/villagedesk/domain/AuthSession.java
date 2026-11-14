package ru.practice.villagedesk.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "sessions")
public class AuthSession {

	@Id
	@Column(length = 64)
	private String token;

	@ManyToOne(fetch = FetchType.EAGER, optional = false)
	@JoinColumn(name = "account_id", nullable = false)
	private Account account;

	@Column(name = "expires_at", nullable = false)
	private long expiresAt;

	protected AuthSession() {
	}

	public AuthSession(String token, Account account, long expiresAt) {
		this.token = token;
		this.account = account;
		this.expiresAt = expiresAt;
	}

	public String getToken() {
		return token;
	}

	public Account getAccount() {
		return account;
	}

	public long getExpiresAt() {
		return expiresAt;
	}
}
