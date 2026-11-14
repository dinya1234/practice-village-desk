package ru.practice.villagedesk.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import ru.practice.villagedesk.domain.Account;

public interface AccountRepository extends JpaRepository<Account, String> {

	Optional<Account> findByLogin(String login);
}
