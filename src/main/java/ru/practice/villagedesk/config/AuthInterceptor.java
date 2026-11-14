package ru.practice.villagedesk.config;

import java.io.IOException;
import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import ru.practice.villagedesk.domain.Account;
import ru.practice.villagedesk.service.AuthService;
import tools.jackson.databind.ObjectMapper;

@Component
public class AuthInterceptor implements HandlerInterceptor {

	public static final String ACCOUNT_ATTRIBUTE = "account";

	private final AuthService authService;
	private final ObjectMapper objectMapper;

	public AuthInterceptor(AuthService authService, ObjectMapper objectMapper) {
		this.authService = authService;
		this.objectMapper = objectMapper;
	}

	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
		Account account = authService.resolve(request.getHeader("Authorization")).orElse(null);
		if (account == null) {
			response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
			response.setContentType(MediaType.APPLICATION_JSON_VALUE);
			response.setCharacterEncoding("UTF-8");
			objectMapper.writeValue(response.getWriter(), Map.of("error", "Нужно войти в аккаунт диспетчера"));
			return false;
		}
		request.setAttribute(ACCOUNT_ATTRIBUTE, account);
		return true;
	}
}
