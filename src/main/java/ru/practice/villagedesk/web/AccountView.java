package ru.practice.villagedesk.web;

import ru.practice.villagedesk.domain.Account;

public record AccountView(String id, String login, String name, String shift) {

	public static AccountView of(Account account) {
		return new AccountView(account.getId(), account.getLogin(), account.getName(), account.getShift());
	}
}
