package ru.practice.villagedesk.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import ru.practice.villagedesk.domain.AuthSession;

public interface AuthSessionRepository extends JpaRepository<AuthSession, String> {

	void deleteByExpiresAtLessThan(long moment);
}
