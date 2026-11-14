package ru.practice.villagedesk.repository;

import java.util.Optional;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import ru.practice.villagedesk.domain.Workspace;

public interface WorkspaceRepository extends JpaRepository<Workspace, Long> {

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select w from Workspace w where w.id = :id")
	Optional<Workspace> findForUpdate(@Param("id") long id);
}
