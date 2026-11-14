package ru.practice.villagedesk;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

@SpringBootTest
@AutoConfigureMockMvc
class ApiIntegrationTests {

	@Autowired
	private MockMvc mvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Test
	void guestBootstrapHasNoAccount() throws Exception {
		MvcResult result = mvc.perform(get("/api/bootstrap"))
			.andExpect(status().isOk())
			.andReturn();
		JsonNode body = body(result);
		assertThat(body.has("account")).isTrue();
		assertThat(body.get("account").isNull()).isTrue();
	}

	@Test
	void loginRejectsWrongPassword() throws Exception {
		MvcResult result = mvc.perform(post("/api/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"login\":\"olga\",\"password\":\"wrong\"}"))
			.andExpect(status().isUnauthorized())
			.andReturn();
		assertThat(body(result).get("error").asText()).isEqualTo("Неверный логин или пароль");
	}

	@Test
	void loginReturnsSharedWorkspace() throws Exception {
		JsonNode body = login("olga", "smena1");
		assertThat(body.get("token").asText()).hasSize(48);
		assertThat(body.get("account").get("name").asText()).isEqualTo("Ольга С.");
		assertThat(body.get("account").get("shift").asText()).isEqualTo("Первая смена");
		assertThat(body.get("version").asLong()).isPositive();
		assertThat(body.get("state").get("residents").size()).isEqualTo(2);
		assertThat(body.get("state").get("calls").size()).isEqualTo(2);
	}

	@Test
	void stateRequiresLogin() throws Exception {
		MvcResult result = mvc.perform(put("/api/state")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"version\":0,\"state\":{}}"))
			.andExpect(status().isUnauthorized())
			.andReturn();
		assertThat(body(result).get("error").asText()).isEqualTo("Нужно войти в аккаунт диспетчера");
	}

	@Test
	void saveAdvancesVersionAndRejectsStaleVersion() throws Exception {
		JsonNode login = login("olga", "smena1");
		String token = login.get("token").asText();
		long version = login.get("version").asLong();
		ObjectNode payload = objectMapper.createObjectNode();
		payload.put("version", version);
		payload.set("state", login.get("state"));
		String text = objectMapper.writeValueAsString(payload);

		MvcResult saved = mvc.perform(put("/api/state")
				.header("Authorization", "Bearer " + token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(text))
			.andExpect(status().isOk())
			.andReturn();
		assertThat(body(saved).get("version").asLong()).isEqualTo(version + 1);

		MvcResult conflict = mvc.perform(put("/api/state")
				.header("Authorization", "Bearer " + token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(text))
			.andExpect(status().isConflict())
			.andReturn();
		JsonNode conflictBody = body(conflict);
		assertThat(conflictBody.get("error").asText()).isEqualTo("Данные уже изменил другой диспетчер");
		assertThat(conflictBody.get("by").asText()).isEqualTo("Ольга С.");
		assertThat(conflictBody.get("version").asLong()).isEqualTo(version + 1);
		assertThat(conflictBody.get("state").get("residents").size()).isEqualTo(2);
	}

	@Test
	void resetRestoresSeedState() throws Exception {
		JsonNode login = login("olga", "smena1");
		String token = login.get("token").asText();
		long version = login.get("version").asLong();
		MvcResult result = mvc.perform(post("/api/reset")
				.header("Authorization", "Bearer " + token))
			.andExpect(status().isOk())
			.andReturn();
		JsonNode body = body(result);
		assertThat(body.get("version").asLong()).isEqualTo(version + 1);
		assertThat(body.get("state").get("residents").size()).isEqualTo(2);
		assertThat(body.get("state").get("calls").size()).isEqualTo(2);
		assertThat(body.get("state").get("queue").size()).isZero();
		assertThat(body.get("state").get("current").isNull()).isTrue();
	}

	private JsonNode login(String login, String password) throws Exception {
		MvcResult result = mvc.perform(post("/api/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"login\":\"" + login + "\",\"password\":\"" + password + "\"}"))
			.andExpect(status().isOk())
			.andReturn();
		return body(result);
	}

	private JsonNode body(MvcResult result) {
		return objectMapper.readTree(result.getResponse().getContentAsByteArray());
	}
}
