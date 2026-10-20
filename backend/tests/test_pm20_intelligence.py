"""Regresión de reglas híbridas, motor de IA y permisos (sin cambios reales de BD)."""
import sys
from pathlib import Path
from uuid import UUID
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from app.services.blocker_service import evaluate_gate, transition_events
from app.schemas.projects import ProjectCreate, ProjectUpdate
from app.schemas.dependencies import DependencyCreate
from app.schemas.intelligence import validate_action, PolicyUpdate
A=str(UUID(int=1)); B=str(UUID(int=2)); P=str(UUID(int=3))
def task(id,status='todo',progress=0): return {'id':id,'title':id,'status':status,'progress':progress}
def link(**kwargs): return {'id':'edge','task_id':B,'depends_on_task_id':A,'dependency_type':'finish_to_start','enforcement':'strict','gate_on':'start',**kwargs}
def run_gate(edge,parent_status='todo',next_status='in_progress',next_progress=0,blockers=[]):
    return evaluate_gate(task(B),[task(A,parent_status),task(B)],[edge],blockers,{'status':next_status,'progress':next_progress})

def test_scrum_and_hybrid_informational_not_blocked():
    assert run_gate({**link(),'enforcement':'informational'})['blocked'] is False
    assert run_gate({**link(),'enforcement':'informational'})['warnings']

def test_traditional_blocking_start():
    assert run_gate(link())['blocked']
    assert not run_gate(link(),parent_status='done')['blocked']

def test_finish_only_rule_does_not_block_start():
    edge={**link(),'gate_on':'finish'}
    assert not run_gate(edge)['blocked']
    assert run_gate(edge,next_status='done',next_progress=100)['blocked']

def test_start_to_start_accepts_active_predecessor():
    edge={**link(),'dependency_type':'start_to_start'}
    assert run_gate(edge)['blocked']
    assert not run_gate(edge,parent_status='in_progress')['blocked']

def test_blockers_can_be_informational():
    row={'id':'one','task_id':B,'status':'open','is_blocking':False}
    assert not run_gate({**link(),'enforcement':'informational'},blockers=[row])['blocked']
    assert run_gate({**link(),'enforcement':'informational'},blockers=[{**row,'is_blocking':True}])['blocked']

def test_read_only_edits_never_blocked():
    assert transition_events(task(B),{'title':'Nuevo'})==(False,False,False)

def test_models_accept_three_methodologies_and_four_relationships():
    for mode in ('scrum','traditional','hybrid'):
        assert ProjectUpdate(methodology=mode).methodology.value==mode
    for kind in ('finish_to_start','start_to_start','finish_to_finish','start_to_finish'):
        assert DependencyCreate(task_id=UUID(int=1),depends_on_task_id=UUID(int=2),dependency_type=kind).dependency_type.value==kind

def test_ai_never_accepts_unauthorized_operations():
    with pytest.raises(ValueError):validate_action('users.make_admin',{'user_id':A})
    with pytest.raises(ValidationError):validate_action('task.reprioritize',{'task_id':A,'priority':'high','owner_id':P})
    with pytest.raises(ValidationError):validate_action('dependency.policy',{'dependency_id':A,'enforcement':'bypass','gate_on':'start'})
    with pytest.raises(ValidationError):PolicyUpdate(auto_enabled=True,allowed_auto_actions=['project.methodology'])
    assert PolicyUpdate().auto_enabled is False
