package ru.practice.villagedesk.web;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ru.practice.villagedesk.config.AuthInterceptor;
import ru.practice.villagedesk.domain.Account;
import ru.practice.villagedesk.service.AuthService;
import ru.practice.villagedesk.service.AuthService.LoginResult;
import ru.practice.villagedesk.service.WorkspaceService;
import ru.practice.villagedesk.service.WorkspaceService.ResetResult;
import ru.practice.villagedesk.service.WorkspaceService.SaveResult;
import ru.practice.villagedesk.service.WorkspaceService.Snapshot;

@RestController
@RequestMapping("/api")
public class ApiController {

	private final AuthService authService;
	private final WorkspaceService workspaceService;

	public ApiController(AuthService authService, WorkspaceService workspaceService) {
		this.authService = authService;
		this.workspaceService = workspaceService;
	}

	@PostMapping("/login")
	public LoginResponse login(@RequestBody(required = false) LoginRequest request) {
		if (request == null) {
			throw ApiException.badRequest("Некорректный запрос");
		}
		LoginResult result = authService.login(request.login(), request.password())
			.orElseThrow(() -> ApiException.unauthorized("Неверный логин или пароль"));
		Snapshot snapshot = workspaceService.snapshot();
		return new LoginResponse(result.token(), AccountView.of(result.account()), snapshot.version(), snapshot.state());
	}

	@GetMapping("/bootstrap")
	public Object bootstrap(@RequestHeader(value = "Authorization", required = false) String authorization) {
		Optional<Account> account = authService.resolve(authorization);
		if (account.isEmpty()) {
			Map<String, Object> guest = new LinkedHashMap<>();
			guest.put("account", null);
			return guest;
		}
		Snapshot snapshot = workspaceService.snapshot();
		return new SnapshotResponse(AccountView.of(account.get()), snapshot.version(), snapshot.state());
	}

	@PutMapping("/state")
	public ResponseEntity<Object> save(@RequestAttribute(AuthInterceptor.ACCOUNT_ATTRIBUTE) Account account,
			@Valid @RequestBody SaveRequest request) {
		if (!request.state().isObject()) {
			throw ApiException.badRequest("Не хватает данных состояния");
		}
		SaveResult result = workspaceService.save(request.version(), request.state());
		Map<String, Object> body = new LinkedHashMap<>();
		if (result.saved()) {
			body.put("version", result.version());
			return ResponseEntity.ok(body);
		}
		body.put("error", "Данные уже изменил другой диспетчер");
		body.put("by", account.getName());
		body.put("version", result.version());
		body.put("state", result.state());
		return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
	}

	@PostMapping("/reset")
	public ResetResponse reset() {
		ResetResult result = workspaceService.reset();
		return new ResetResponse(result.version(), result.state());
	}

	@PostMapping("/logout")
	public Map<String, Object> logout(@RequestHeader(value = "Authorization", required = false) String authorization) {
		authService.close(authorization);
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("ok", true);
		return body;
	}
}
