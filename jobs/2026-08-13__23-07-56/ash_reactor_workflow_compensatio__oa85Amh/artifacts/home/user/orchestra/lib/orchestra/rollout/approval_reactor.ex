defmodule Orchestra.Rollout.ApprovalReactor do
  use Ash.Reactor

  input :rollout_id
  input :total_slots
  input :board_threshold

  return :pick_approval_level

  step :switch_input do
    argument :total_slots, input(:total_slots)
    argument :board_threshold, input(:board_threshold)
    run fn args, _context ->
      {:ok, {args.total_slots, args.board_threshold}}
    end
  end

  switch :pick_approval_level do
    on result(:switch_input)

    matches? fn {total_slots, board_threshold} -> total_slots >= board_threshold end do
      return :create_board_approval

      create :create_board_approval, Orchestra.Fleet.Approval, :create do
        undo_action :revoke
        undo :always
        inputs %{
          rollout_id: input(:rollout_id),
          level: value(:board),
          slots: input(:total_slots),
          status: value(:granted)
        }
      end
    end

    default do
      return :create_auto_approval

      create :create_auto_approval, Orchestra.Fleet.Approval, :create do
        undo_action :revoke
        undo :always
        inputs %{
          rollout_id: input(:rollout_id),
          level: value(:auto),
          slots: input(:total_slots),
          status: value(:granted)
        }
      end
    end
  end
end
