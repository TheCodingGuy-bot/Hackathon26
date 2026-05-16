# Hackathon 2026 - Milestone Escrow DApp

## Overview
A decentralized milestone-based escrow system for AI agents to manage freelance contracts with on-chain dispute resolution powered by Solana.

## Architecture
- **frontend/** - React + TypeScript + Vite (Wallet integration)
- **backend/** - Spring Boot (REST API)
- **programs/** - Solana Anchor smart contract

## Quick Start

### Frontend
```bash
cd frontend && npm install && npm run dev
```

### Backend
```bash
cd backend && mvn spring-boot:run
```

### Solana Program
```bash
anchor deploy
```

## Key Features
- Milestone-based payments with on-chain escrow
- AI Judge resolution for rejected work
- Phantom wallet browser integration
- Real-time project status updates

## Smart Contract
- Program ID: `6NikvvCPKpAkbdXWg8NtNes77mno854GjCouQqmkgyBS`
- Network: Solana Local Validator

## User Roles
- **Client** - Creates projects, approves milestones
- **Developer** - Submits milestone work
- **Judge** - Resolves disputes via blockchain
