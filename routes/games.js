const router = require('express').Router()
const passport = require('../config/auth')
const { Game } = require('../models')

const authenticate = passport.authorize('jwt', { session: false })

const checkWiningCombinations = (squares, x, y, z) => {
  return (squares[x] === squares[y] &&
          squares[y] === squares[z] &&
          squares[x] !== null)
}

module.exports = io => {
  router
    .get('/games', (req, res, next) => {
      Game.find()
        .sort({ createdAt: -1 })
        .then((games) => res.json(games))
        .catch((error) => next(error))
    })
    .get('/games/:id', (req, res, next) => {
      const id = req.params.id

      Game.findById(id)
        .then((game) => {
          if (!game) { return next() }
          res.json(game)
        })
        .catch((error) => next(error))
    })
    .post('/games', authenticate, (req, res, next) => {
      const newGame = {
        userId: req.account._id,
        players: [{
          userId: req.account._id,
        }],
        squares: Array(9).fill(null),
        }

      Game.create(newGame)
        .then((game) => {
          io.emit('action', {
            type: 'GAME_CREATED',
            payload: game
          })
          res.json(game)
        })
        .catch((error) => next(error))
    })
    .put('/games/:id', authenticate, (req, res, next) => {
      const id = req.params.id
      const randomNumber = Math.random()
      const turn = (randomNumber >= 0.5) ? 0 : 1

      const updatedGame = {
        started: true,
        squares: Array(9).fill(null),
        turn: turn,
        winnerId: null
      }

      Game.findByIdAndUpdate(id, { $set: updatedGame }, { new: true })
        .then((game) => {
          io.emit('action', {
            type: 'GAME_UPDATED',
            payload: game
          })
          console.log(game)
          res.json(game)
        })
        .catch((error) => next(error))
    })
    .patch('/games/:id', authenticate, (req, res, next) => {
      const id = req.params.id
      const index = req.body.index
      const playerName = req.body.name
      const playerId = req.body.userId

      Game.findById(id)
        .then((game) => {
          if (!game) { return next() }

          const playerWithTurnId = game.players[game.turn].userId.toString()

          if (playerWithTurnId !== playerId) {
            const error = new Error ('Wait for your turn')
            error.status = 401
            return next(error)
          }

          let turn = game.turn
          updatedTurn = (turn === 0) ? 1 : 0

          const squareSymbol = turn === 0 ? 'O' : 'X'

          let squares = game.squares
          squares[index] = squareSymbol

          let patchForWinner = {}

          if (checkWiningCombinations(squares, 0, 1, 2) ||
              checkWiningCombinations(squares, 3, 4, 5) ||
              checkWiningCombinations(squares, 6, 7, 8) ||
              checkWiningCombinations(squares, 0, 3, 6) ||
              checkWiningCombinations(squares, 1, 4, 7) ||
              checkWiningCombinations(squares, 2, 5, 8) ||
              checkWiningCombinations(squares, 0, 4, 8) ||
              checkWiningCombinations(squares, 2, 4, 6)
          ) {
              patchForWinner = {
                winnerId: playerId,
                started: false
              }
            }



          const updatedGame = { ...game, ...patchForWinner, turn: updatedTurn, squares: squares,  }

          Game.findByIdAndUpdate(id, { $set: updatedGame }, { new: true })

            .then((game) => {
              io.emit('action', {
                type: 'GAME_UPDATED',
                payload: game
              })
              res.json(game)
            })
            .catch((error) => next(error))
        })
        .catch((error) => next(error))
    })
    .delete('/games/:id', authenticate, (req, res, next) => {
      const id = req.params.id
      Game.findByIdAndRemove(id)
        .then(() => {
          io.emit('action', {
            type: 'GAME_REMOVED',
            payload: id
          })
          res.status = 200
          res.json({
            message: 'Removed',
            _id: id
          })
        })
        .catch((error) => next(error))
    })

  return router
}
