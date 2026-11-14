package ru.practice.villagedesk.web;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

	@ExceptionHandler(ApiException.class)
	public ResponseEntity<Map<String, Object>> handle(ApiException error) {
		return ResponseEntity.status(error.getStatus()).body(body(error.getMessage()));
	}

	@ExceptionHandler(HttpMessageNotReadableException.class)
	public ResponseEntity<Map<String, Object>> handleUnreadable() {
		return ResponseEntity.badRequest().body(body("Некорректный запрос"));
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<Map<String, Object>> handleInvalid() {
		return ResponseEntity.badRequest().body(body("Не хватает данных состояния"));
	}

	private Map<String, Object> body(String message) {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("error", message);
		return body;
	}
}
