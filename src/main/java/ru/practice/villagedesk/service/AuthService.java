package ru.practice.villagedesk.service;

import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ru.practice.villagedesk.domain.Account;
import ru.practice.villagedesk.domain.AuthSession;
import ru.practice.villagedesk.repository.AccountRepository;
import ru.practice.villagedesk.repository.AuthSessionRepository;

@Service
public class AuthService {

	private static final SecureRandom RANDOM = new SecureRandom();
	private static final int TOKEN_BYTES = 24;

	private final AccountRepository accounts;
	private final AuthSessionRepository sessions;
	private final PasswordEncoder passwordEncoder;
	private final long sessionTtlMillis;

	public AuthService(AccountRepository accounts, AuthSessionRepository sessions, PasswordEncoder passwordEncoder,
			@Value("${app.session.ttl-hours:12}") long sessionTtlHours) {
		this.accounts = accounts;
		this.sessions = sessions;
		this.passwordEncoder = passwordEncoder;
		this.sessionTtlMillis = sessionTtlHours * 60L * 60L * 1000L;
	}

	@Transactional
	public Optional<LoginResult> login(String login, String password) {
		String normalized = login == null ? "" : login.trim().toLowerCase(Locale.ROOT);
		if (normalized.isEmpty() || password == null || password.isEmpty()) {
			return Optional.empty();
		}
		Optional<Account> found = accounts.findByLogin(normalized);
		if (found.isEmpty()) {
			return Optional.empty();
		}
		Account account = found.get();
		if (!passwordEncoder.matches(password, account.getPasswordHash())) {
			return Optional.empty();
		}
		sessions.deleteByExpiresAtLessThan(System.currentTimeMillis());
		byte[] tokenBytes = new byte[TOKEN_BYTES];
		RANDOM.nextBytes(tokenBytes);
		String token = HexFormat.of().formatHex(tokenBytes);
		sessions.save(new AuthSession(token, account, System.currentTimeMillis() + sessionTtlMillis));
		return Optional.of(new LoginResult(account, token));
	}

	@Transactional
	public Optional<Account> resolve(String authorization) {
		String token = tokenOf(authorization);
		if (token == null) {
			return Optional.empty();
		}
		Optional<AuthSession> found = sessions.findById(token);
		if (found.isEmpty()) {
			return Optional.empty();
		}
		AuthSession session = found.get();
		if (session.getExpiresAt() < System.currentTimeMillis()) {
			sessions.delete(session);
			return Optional.empty();
		}
		return Optional.of(session.getAccount());
	}

	@Transactional
	public void close(String authorization) {
		String token = tokenOf(authorization);
		if (token != null) {
			sessions.findById(token).ifPresent(sessions::delete);
		}
	}

	private String tokenOf(String authorization) {
		if (authorization == null || authorization.length() < 8) {
			return null;
		}
		if (!authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
			return null;
		}
		String token = authorization.substring(7).trim();
		return token.isEmpty() ? null : token;
	}

	public record LoginResult(Account account, String token) {
	}
}
